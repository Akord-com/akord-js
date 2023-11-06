import { Encryptable, encrypted, EncryptedKeys } from "@akord/crypto";
import { StorageType } from ".";

export class ProfileDetails extends Encryptable {

  constructor(profileDetailsProto: any, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.name = profileDetailsProto?.name;
    this.avatarUri = profileDetailsProto?.avatarUri;
  }

  @encrypted() name?: string;
  avatarUri?: string[];
  avatar?: ArrayBuffer;

  getAvatarUri(type: StorageType = StorageType.S3): string {
    return this.avatarUri
      ?.find(uri => uri.startsWith(type))
      ?.replace(type, "");
  }
}
