const exitId = "ccr2fcu9gbrk70si8020"

export function onActivate(): void {
    Room.listenExit(exitId)
}

export function onExitUse(addr: string, exitIntercept: ExitIntercept): void {
    if(exitIntercept.exitId === exitId && !matchGender((Room.getChar(exitIntercept.charId) as Room.Char).gender as string)) {
        exitIntercept.cancel("The door remains locked for those who do not drink of the elixer, or who are naturally a maleherm.")
    } else {
        exitIntercept.useExit()
    }
}

function matchGender(gender: string): boolean {
    gender = gender.trim()
    gender = gender.toLowerCase()
    gender = gender.replaceAll(".", "")
    gender = gender.replaceAll(" ", "")
    gender = gender.replaceAll("-", "")
    return (gender.includes("maleherm")
        || gender.includes("mascherm")
        || gender.includes("masculineherm")
        || (gender.includes("mherm") && !gender.includes("femherm"))
        || gender.includes("boyherm")
        || gender.includes("boiherm")
        || gender.includes("hermandrodite")) as boolean
}