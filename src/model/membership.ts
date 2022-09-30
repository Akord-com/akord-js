import { Cacheable } from "./cacheable";

export interface Membership extends Cacheable {
    id: string;
    address: string;
    status: string;
    role: string;
    data?: string[];
  }
