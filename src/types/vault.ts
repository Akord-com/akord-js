import { Encryptable, encrypted, Keys } from "@akord/crypto";

export class Vault extends Encryptable {
    id: string;
    status: string;
    public: boolean;
    createdAt: string;
    updatedAt: string;
    size?: number;
    @encrypted() name: string;

    constructor(vaultProto: any, keys: Array<Keys>){
        super(keys, null)
        this.id = vaultProto.id;
        this.public = vaultProto.public;
        this.createdAt = vaultProto.createdAt;
        this.updatedAt = vaultProto.updatedAt;
        this.size = vaultProto.size;
        this.name = vaultProto.name;
        this.status = vaultProto.status;
        this.keys = keys;
    }   
  }
