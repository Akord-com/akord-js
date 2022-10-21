import { Cacheable } from "./cacheable";

export interface ProfileDetails extends Cacheable {
    publicSigningKey: string;
    email: string;
    fullName?: string;
    phone?: string;
    avatarUrl?: string;
    avatarTx?: string;
    avatar?: ArrayBuffer;
  }
