import { NotFound } from "../errors/not-found";
import { Tags } from "./contract";
import { Version } from "./node";
import { Encryptable, encrypted, EncryptedKeys } from "@akord/crypto";

export class FileVersion extends Encryptable implements Version {
  @encrypted() name: string;
  type: string; //type
  resourceUri: string[];
  size: number;
  numberOfChunks?: number;
  chunkSize?: number;
  iv?: [string];
  encryptedKey?: string;
  owner: string;
  createdAt: string;

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
    const resourceUri = this.resourceUri
      ?.find(uri => uri.startsWith(type))
      ?.replace(type + ":", "");
    if (!resourceUri) {
      throw new NotFound("Could not find resource uri for given type: " + type);
    }
    return resourceUri;
  }
}

export type FileDownloadOptions = Hooks & {
  index?: number,
  path?: string,
  skipSave?: boolean,
}

export type FileGetOptions = FileDownloadOptions & {
  responseType?: 'arraybuffer' | 'stream',
}

export type FileUploadResult = {
  resourceUri: string[],
  resourceHash?: string,
  numberOfChunks?: number,
  chunkSize?: number,
  iv?: string[]
  encryptedKey?: string
}

export type Hooks = {
  progressHook?: (percentageProgress: number, bytesProgress?: number, id?: string) => void,
  cancelHook?: AbortController
}

export type FileUploadOptions = Hooks & {
  public?: boolean,
  storage?: StorageType,
  arweaveTags?: Tags,
  chunkSize?: number
}

export enum StorageType {
  ARWEAVE = "arweave",
  S3 = "s3"
}
