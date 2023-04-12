import { Encryptable, encrypted, EncryptedKeys } from "@akord/crypto";

export class ProfileDetails extends Encryptable {

  constructor(profileDetailsProto: any, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.name = profileDetailsProto.name;
    this.avatarUri = profileDetailsProto.avatarUri;
  }

  @encrypted() name?: string;
  avatarUri?: string[];
  avatar?: ArrayBuffer;
}
