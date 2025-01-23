const exitId = "cnbb1ke9gbribk1skshg"
const ownerId = "c2i9uh0t874bj4evc090"
const locksmith = "room.c2vvcegt874d92krc4o0#cu5vb6u9gbrvmv4tm3i0"

export function onActivate(): void {
    Room.listenExit(exitId)
    Script.listen([locksmith])
    Store.setBuffer(ownerId, new ArrayBuffer(1))
}

export function onMessage(addr: string, topic: string, dta: string, sender: string): void {
    var key = JSON.parse<string>(dta)
    if(topic == "addkey") {
        Store.setBuffer(key, new ArrayBuffer(1))
    } 

    if(topic == "remkey") {
        Store.deleteKey(key)
    }
}

export function onExitUse(addr: string, exitIntercept: ExitIntercept): void {
    if (Store.getBuffer(exitIntercept.charId) == null) {
        exitIntercept.cancel("The door is locked.")
    } else {
        exitIntercept.useExit()
    }
}