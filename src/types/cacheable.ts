import { Subject } from "rxjs"

export interface Cacheable {
    _cached: boolean
}

export class CacheBusters {
    static cache: boolean;
    static profile = new Subject<any>();
    static vaults = new Subject<any>();
}
