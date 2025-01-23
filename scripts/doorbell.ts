const Hallway = ""

export function onActivate(): void {
    Script.listen([Hallway])
}

export function onMessage(addr: string, topic: string, dta: string): void {
    if (topic == "waiting") {
        if(!Room.unlisten()) {
            Script.post(Hallway, "nobody's home")
        }
    } else {
        if (topic == "ring") {
            Room.describe("The doorbell rings.")
        } else if (topic == "msg") {
            Room.describe("The doorbell rings and a voice can be heard, ${dta}")
        }
        //I only care if there is anyone in the room
        if (Room.charIterator().isValid()) {
            Room.listen()
            Script.post("#", "waiting", null, 5000)
        } else {
            Script.post(Hallway, "nobody's home", null, 5000)
        }
    }
}

export function onRoomEvent(addr: string, evjson: string): void {
    if (Event.getType(evjson) == "say") {
        Script.post(Hallway, "msg", evjson)
        Room.unlisten()
    }
}