const owners = [
    "c2i9uh0t874bj4evc090",
    "c62rjs0t874cqited7b0"
]

export function onActivate(): void {
    Room.listen()
}

export function onRoomEvent(addr: string, evjson: string): void {
    if (Event.getType(evjson) == "ooc") {
        let ev = JSON.parse<Event.OOC>(evjson)
        let m = ev.msg.toLowerCase()
        if (owners.includes(ev.char.id)) {
            if (m == "ping") {
                Room.describe("pong")
            }
            let cmd = m.split(" ")
            if (cmd[0] == "reg") {
                Store.setString(cmd[1], cmd[2])
                Script.listen([cmd[2]])
                Room.describe(`Registered doorbell for apartment ${cmd[1]}, doorbell script ${cmd[2]}`)
            } else if (cmd[0] == "unreg") {
                Script.unlisten([Store.getString(cmd[1]) as string])
                Store.deleteKey(cmd[1])
                Room.describe(`Removed doorbell from apartment ${cmd[1]}`)
            }
        }
    } else if (Event.getType(evjson) == "pose") {
        let ev = JSON.parse<Event.Pose>(evjson)
        if (ev.msg.startsWith("ring")) {
            let m = ev.msg.substr(4).trim()
            let unit = m.substr(0, m.indexOf("=")).trim()
            let msg = m.substr(m.indexOf("=")).trim()
            let bell = Store.getString(unit)
            if (bell) {
                if (msg) {
                    Script.post(bell, "msg", JSON.stringify(msg))
                } else {
                    Script.post(bell, "ring")
                }
            }
        }
    }
}

export function onMessage(addr: string, topic: string, dta: string): void {
    if (topic == "msg") {
        if (Event.getType(dta) == "say") {
            let say = JSON.parse<Event.Say>(dta)
            Room.describe(`**${say.char.name}** says through the speaker at apartment ${findByValue(addr)}, "${say.msg}"`)
        }
    } else if (topic == "nobody's home") {
        Room.describe(`There was no response at apartment ${findByValue(addr)}.`)
    }
}

function findByValue(val: string): string | null {
    let i = new Store.Iterator()
    while (i.isValid()) {
        if (i.getValueString() == val) {
            return i.getKeyString()
        }
        i.next()
    }
    return null
}