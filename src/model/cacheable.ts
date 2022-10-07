import { Subject } from "rxjs"


export class CacheConfig {
    static enabled: boolean;
    static profileBuster = new Subject<any>();
    static vaultsBuster = new Subject<any>();
}
