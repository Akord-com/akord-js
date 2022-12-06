import { Encryptable, encrypted, Keys } from "@akord/crypto";

export class ProfileDetails extends Encryptable {

  constructor(name: string, publicSigningKey: string, email: string, avatarUrl: string, keys?: Array<Keys>, publicKey?: string) {
    super(keys, publicKey);
    this.name = name;
    this.publicSigningKey = publicSigningKey;
    this.email = email;
    this.avatarUrl = avatarUrl;
  }

    @encrypted() name?: string;
    publicSigningKey: string;
    email: string;
    phone?: string;
    avatarUri?: string[];
    avatarUrl?: string;
    avatarTx?: string;
    avatar?: ArrayBuffer;
  }
