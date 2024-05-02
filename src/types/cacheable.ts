import { Subject } from "rxjs"

export class CacheConfig {
  static cache: boolean;
  static profileBuster = new Subject<any>();
}
