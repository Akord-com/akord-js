import { Encryptable, encrypted, EncryptedKeys } from "@akord/crypto";
import { StorageType, Version } from "./node";

export class FileVersion extends Encryptable implements Version {
  @encrypted() name: string;
  type: string;
  resourceUri: string[];
  owner: string;
  createdAt: string;
  status: string;
  size: number;
  numberOfChunks?: number;
  chunkSize?: number;
  iv?: [string];
  encryptedKey?: string;


  constructor(fileVersionProto: any, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = fileVersionProto.owner;
    this.createdAt = fileVersionProto.createdAt;
    this.type = fileVersionProto.type;
    this.resourceUri = fileVersionProto.resourceUri;
    this.size = fileVersionProto.size;
    this.numberOfChunks = fileVersionProto.numberOfChunks;
    this.chunkSize = fileVersionProto.chunkSize;
    this.name = fileVersionProto.name;
    this.status = fileVersionProto.status;
    this.iv = fileVersionProto.iv;
    this.encryptedKey = fileVersionProto.encryptedKey;
  }

  getUri(type: StorageType): string {
    return this.resourceUri
      ?.find(uri => uri.startsWith(type))
      ?.replace(type, "");
  }
}
