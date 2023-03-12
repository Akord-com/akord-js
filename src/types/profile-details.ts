import { Encryptable, encrypted, EncryptedKeys } from "@akord/crypto";

export class ProfileDetails extends Encryptable {

  constructor(name: string, publicSigningKey: string, email: string, avatarUri: Array<string>, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.name = name;
    this.publicSigningKey = publicSigningKey;
    this.email = email;
    this.avatarUri = avatarUri;
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
