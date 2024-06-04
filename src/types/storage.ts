export class Storage {
    cloudStorageAvailable: number
    cloudStorageTotal: number
    permanentStorageAvailable: number
    permanentStorageTotal: number

    constructor(json: any) {
        this.cloudStorageAvailable = json.cloudStorageAvailable
        this.cloudStorageTotal = json.cloudStorageTotal
        this.permanentStorageAvailable = json.permanentStorageAvailable
        this.permanentStorageTotal = json.permanentStorageTotal
    }
}

export type StorageBuyOptions = {
    simulate?: boolean
}

export type StorageBuyResponse = {
    simulate?: boolean,
}