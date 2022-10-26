import { Cacheable } from "./cacheable";

export interface Membership extends Cacheable {
  id: string;
  owner: string; // owner's address
  createdAt: number;
  updatedAt: number;
  status: string;
  address: string;
  role: string;
  data?: string[];
  encPublicSigningKey: string;
  keys: Keys[];
  memberDetails: {
    fullName: string,
    avatar: string
  }
}

export interface Keys {
  encPrivateKey: string;
  encPublicKey: string;
}
