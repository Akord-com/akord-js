import { Encryptable, encrypted, Keys } from "@akord/crypto";

export class Vault extends Encryptable {
    id: string;
    status: string;
    public: boolean;
    size?: string;

    @encrypted()
    name: string;

    constructor(id: string, name: string, isPublic: boolean, keys: Array<Keys>){
        super(keys, null)
        this.id = id;
        this.public = isPublic;
        this.name = name;
    }   
  }
