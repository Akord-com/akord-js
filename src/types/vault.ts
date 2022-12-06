import { Encryptable, encrypted, Keys } from "@akord/crypto";

export class Vault extends Encryptable {
  id: string;
  status: string;
  public: boolean;
  createdAt: string;
  updatedAt: string;
  data: Array<string>;
  size?: number;
  @encrypted() name: string;

  constructor(vaultProto: any, keys: Array<Keys>) {
    super(keys, null);
    this.id = vaultProto.id;
    this.public = vaultProto.public;
    this.createdAt = vaultProto.createdAt;
    this.updatedAt = vaultProto.updatedAt;
    this.size = vaultProto.storage?.storage_used;
    this.name = vaultProto.name;
    this.status = vaultProto.status;
    this.data = vaultProto.data;
    this.keys = keys;
  }
}
