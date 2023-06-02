import { encrypted, EncryptedKeys } from "@akord/crypto";
import { Node, NodeCreateOptions } from "./node";
import { FileUploadOptions, FileVersion, StorageClass } from "./file";

export class Stack extends Node {
  @encrypted() name: string;
  versions: Array<FileVersion>;

  constructor(nodeLike: any, keys: Array<EncryptedKeys>) {
    super(nodeLike, keys);
    this.name = nodeLike.name;
    this.versions = (nodeLike.versions || []).map((version: FileVersion) => new FileVersion(version, keys));
  }

  getUri(type: StorageClass = StorageClass.ARWEAVE, index?: number): string {
    const version = this.getVersion(index);
    return version.getUri(type);
  }

  getVersion(index?: number): FileVersion {
    return super.getVersion(index) as FileVersion;
  }
}

export type StackCreateOptions = NodeCreateOptions & FileUploadOptions;

export type StackCreateResult = {
  stackId: string,
  transactionId: string,
  object: Stack
}

export type StackUpdateResult = {
  transactionId: string,
  object: Stack
}