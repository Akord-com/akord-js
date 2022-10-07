import { Encryptable, encrypted, Keys } from "@akord/crypto";

export class Vault extends Encryptable {
    constructor(id: string, name: string, modifiedAt: string, size: number, membershipId: string, isPublic: boolean, keys: Array<Keys>, publicKey: string) {
      super(keys, publicKey);
      this.id = id;
      this.name = name;
      this.modifiedAt = modifiedAt;
      this.size = size;
      this.membershipId = membershipId;
      this.isPublic = isPublic;
    }

    id: string;
    @encrypted() name: string;
    modifiedAt: string;
    size?: number;
    membershipId?: string;
    isPublic?: boolean;
  }
