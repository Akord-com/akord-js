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

export type DownloadOptions = FileDownloadOptions & { name?: string }

export type FileUploadResult = {
  resourceUri: string[],
  numberOfChunks?: number,
  chunkSize?: number,
}

export type Hooks = {
  progressHook?: (progress: number, data?: any) => void,
  cancelHook?: AbortController
}

export type FileUploadOptions = Hooks & {
  public?: boolean,
  storage?: StorageType,
  arweaveTags?: Tags
}

export type FileDownloadOptions = Hooks & {
  public?: boolean,
  isChunked?: boolean,
  numberOfChunks?: number,
  loadedSize?: number,
  resourceSize?: number
}

export enum StorageType {
  ARWEAVE = "arweave",
  S3 = "s3"
}