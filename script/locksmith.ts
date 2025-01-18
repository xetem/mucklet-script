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
        if(owners.includes(ev.char.id)) {
            if(m == "ping") {
                Room.describe("pong")
            }
            let mm = m.split(" ")
            if(mm[0] == "reg") {
                Store.setString(mm[1], mm[2])
                Script.listen([mm[2]])
                Room.describe(`Listening to lock ${mm[2]}, owned by ${mm[1]}`)
            } else if (mm[0] == "unreg") {
                Script.unlisten([Store.getString(mm[1]) as string])
                Store.deleteKey(mm[1])
                Room.describe(`Stopped listening to lock owned by ${mm[1]}`)
            } else if (mm[0] == "addkey") {
                let lock = Store.getString(mm[1])
                if (lock != null) {
                    Script.post(lock, "addkey", JSON.stringify(mm[2]))
                    Room.describe(`Granted access to ${mm[1]} lock to ${mm[2]}`)
                }
            } else if (mm[0] == "remkey") {
                let lock = Store.getString(mm[1])
                if (lock != null) {
                    Script.post(lock, "remkey", JSON.stringify(mm[2]))
                    Room.describe(`Revoked access to ${mm[1]} lock from ${mm[2]}`)
                }
            }
        }
    }
}