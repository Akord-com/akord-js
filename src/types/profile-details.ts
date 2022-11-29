import { Encryptable, encrypted } from "@akord/crypto";

export class ProfileDetails extends Encryptable{
    @encrypted() name?: string;
    publicSigningKey: string;
    email: string;
    phone?: string;
    avatarUri?: string[];
    avatarUrl?: string;
    avatarTx?: string;
    avatar?: ArrayBuffer;
  }
