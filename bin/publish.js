import { readFile } from "fs/promises";
import path from "path";
import { parse } from "tinyargs";
import { stdoutColors } from "./utils/terminal.js";
import { printHelp, printError } from "./utils/options.js";
import { getToken, loadConfig, compileScript, errToString } from "./utils/tools.js";
import { createClient } from "./utils/client.js";

const defaultOutputDir = ".";
const defaultOutFile = "[name].wasm";

const options = [
	{ name: "config", flags: [ "c" ], type: String, default: "mucklet.config.js", value: "file", desc: "Mucklet script project config file" },
	{ name: "name", type: String, value: "keyword", desc: "Name of project script(s) to publish" },
	{ name: "room", type: String, value: "room id", desc: "Room ID of project script(s) to publish" },
	{ name: "apiurl", flags: [ "a" ], type: String, value: "url", desc: "Realm API WebSocket URL (eg. wss://api.test.mucklet.com)" },
	{ name: "token", flags: [ "t" ], type: String, value: "string", desc: [
		"Manager token (generated in realm under Player Settings)",
		"Overrides the MUCKLET_TOKEN environment variable",
	] },
	{ name: "tokenfile", flags: [ "T" ], type: String, value: "file", desc: [
		"File containing the manager token",
		"Overrides the MUCKLET_TOKEN_FILE environment variable",
	] },
	{ name: "help", flags: [ "h" ], type: Boolean, stop: true, desc: "Show this message" },
	{ name: "file", type: String, positional: true, optionalValue: true },
];

function help() {
	printHelp("Publish scripts to a Mucklet realm.", {
		syntax: [ stdoutColors.cyan("mucklet-script publish") + " [options] [file]" ],
		options: options,
	});
}

export default async function(version, args) {
	const cli = parse(args, options);
	if (cli.help) {
		help();
		process.exit(0);
	}

	const cfg = await loadConfig(version, cli.config || 'mucklet.config.js', !cli.config && {});

	if (cli.files) {
		if (cli.name) {
			printError("cannot filter by name when building single script files", help);
		}
		if (cli.room) {
			printError("cannot filter by room ID when building single script files", help);
		}
		cfg.scripts = cli.files.map(file => ({
			name: path.parse(file).name,
			path: file,
		}));
	}

	// Realm configuration
	if (cli.apiurl) {
		cfg.realm = Object.assign({}, cfg.realm, { apiUrl: cli.apiurl });
	}

	// Get token from cli or from environment variables
	const token = getToken(cli.token, cli.tokenFile);

	// Filter by name
	if (cli.name && cfg.scripts) {
		cfg.scripts = cfg.scripts.filter(script => script.name == cli.name);
	}

	// Filter by room ID
	if (cli.room && cfg.scripts) {
		cfg.scripts = cfg.scripts.filter(script => script.room == cli.room || ("#" + script.room) == cli.room);
	}

	// Validate config
	if (!token) {
		throw "missing realm manager token";
	}
	if (!cfg.realm?.apiUrl) {
		throw "missing realm api url";
	}

	await publishScripts(cfg, token, version);
}

async function publishScripts(cfg, token, version) {
	if (!cfg.scripts?.length) {
		printError("no scripts to publish", help);
		return;
	}

	const client = await createClient(cfg.realm.apiUrl, token);

	try {

		let errors = [];

		for (const script of cfg.scripts) {
			errors.push(await publishScript(cfg, script, client, version));
		}

		console.log("\n" + stdoutColors.white("Publish result:"));
		console.log(cfg.scripts.map((script, idx) => {
			let name = script.name + (script.room ? "Room #" + script.room : "");
			return "  " +
				(errors[idx]
					? stdoutColors.red("✗ ") + name + " - " + stdoutColors.red(errors[idx])
					: stdoutColors.green("✓ ") + name
				);
		}).join("\n"));
	} finally {
		client.disconnect();
	}
}

function replacePlaceholder(file, script) {
	return file
		.replace(/\[name\]/, script.name)
		.replace(/\[room\]/, script.room || "noroom");
}

function skipWithMessage(msg) {
	console.log("Skipping: " + stdoutColors.red(msg));
	return msg;
}

function errorMsg(msg, err) {
	err = errToString(err);
	console.log();
	console.log(stdoutColors.red(err));
	return msg + ": " + err;
}

async function publishScript(cfg, script, client, version) {
	console.log("\nBuilding script " + stdoutColors.cyan(script.path) + " ...");

	const room = (script.room || "").trim().replace(/^#/, '');
	if (!room) {
		return skipWithMessage("missing room");
	}
	if (!room.match(/^[a-vA-V0-9]{20,20}$/)) {
		return skipWithMessage("invalid room ID");
	}

	const outputDir = replacePlaceholder(cfg.output?.dir || defaultOutputDir, script);
	const outFile = path.join(outputDir, replacePlaceholder(cfg.output?.outFile || defaultOutFile, script));

	try {
		compileScript(script.path, outFile);
	} catch (err) {
		console.log();
		console.log(err?.stderr?.toString
			? stdoutColors.red(err.stderr.toString())
			: err,
		);
		return "build error";
	}

	console.log("Outfile: " + stdoutColors.cyan(outFile));
	console.log("Getting existing room script ...");

	let roomScript;
	try {
		roomScript = await getRoomScriptByName(client, room, script.name);
	} catch (err) {
		return errorMsg("error getting room", err);
	}


	console.log("Upload file...");
	const contents = await readFile(outFile, { encoding: 'base64' });

	if (roomScript) {
		console.log(`Updating room script #${roomScript.id} ...`);
		try {
			roomScript = await roomScript.call('set', {
				key: script.name,
				binary: contents,
				target: version,
				active: typeof script.active == "boolean" ? script.active : undefined,
			});
		} catch (err) {
			return errorMsg("error updating room script", err);
		}
	} else {
		console.log("Creating room script ...");
		try {
			roomScript = await client.call(`core.room.${room}.scripts`, 'create', {
				binary: contents,
				target: version,
				active: typeof script.active == "boolean" ? script.active : undefined,
			});
		} catch (err) {
			return errorMsg("error creating room script", err);
		}
	}

	return null;
}

/**
 * Get a room script model by name from the API.
 * @param {ApiClient} client API client.
 * @param {string} room  Room ID.
 * @param {*} name Script name/key
 * @returns {Model}
 */
async function getRoomScriptByName(client, room, name) {
	name = name.toLowerCase();
	let roomScripts = await client.get(`core.room.${room}.scripts`);
	for (let roomScript of roomScripts) {
		if (roomScript.key == name) {
			return roomScript;
		}
	}
	return null;
}
