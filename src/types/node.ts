import { Encryptable, encrypted, EncryptedKeys } from "@akord/crypto";
import { status } from "../constants";
import { NotFound } from "../errors/not-found";

export enum nodeType {
  STACK = "Stack",
  FOLDER = "Folder",
  MEMO = "Memo",
  NOTE = "Note"
}

export type NodeType = "Stack" | "Folder" | "Memo" | "Note";

export abstract class Node extends Encryptable {
  id: string;
  owner: string;
  createdAt: string; // number
  updatedAt: string; // number
  status: status;
  vaultId: string;
  parentId?: string;
  data?: Array<string>;
  tags: string[];

  constructor(id: string, createdAt: string, updatedAt: string, status: status, vaultId: string, owner: string, data: Array<string>, parentId: string, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.status = status;
    this.vaultId = vaultId;
    this.owner = owner;
    this.data = data;
    this.parentId = parentId;
  }

  getVersion(index?: number): Version {
    if (index) {
      if (this.versions && this.versions[index]) {
        return this.versions[index];
      } else {
        throw new NotFound("A version with given index: " + index + " does not exist for node: " + this.id);
      }
    } else {
      return this.versions && this.versions[this.versions.length - 1];
    }
  }
}

export class Folder extends Node {
  @encrypted() name: string;
  size: number;

  constructor(nodeLike: any, keys: Array<EncryptedKeys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys);
    this.name = nodeLike.name;
    this.size = nodeLike.size;
  }
}

export class Stack extends Node {
  @encrypted() name: string;
  versions: Array<FileVersion>;

  constructor(nodeLike: any, keys: Array<EncryptedKeys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys);
    this.name = nodeLike.name;
    this.versions = (nodeLike.versions || []).map((version: FileVersion) => new FileVersion(version, keys));
  }

  getUri(type: StorageType = StorageType.ARWEAVE, index?: number): string {
    const version = this.getVersion(index);
    return version.getUri(type);
  }

  getVersion(index?: number): FileVersion {
    return super.getVersion(index) as FileVersion;
  }
}

export class Note extends Node {
  @encrypted() name: string;
  versions: Array<FileVersion>;

  constructor(nodeLike: any, keys: Array<EncryptedKeys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys);
    this.name = nodeLike.name;
    this.versions = (nodeLike.versions || []).map((version: FileVersion) => new FileVersion(version, keys));
  }
}

export class Memo extends Node {
  versions: Array<MemoVersion>;

  constructor(nodeLike: any, keys: Array<EncryptedKeys>, publicKey?: string) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys, publicKey);
    this.versions = (nodeLike.versions || []).map((version: MemoVersion) => new MemoVersion(version, keys, publicKey));
  }

  getVersion(index?: number): MemoVersion {
    return super.getVersion(index) as MemoVersion;
  }
}

export abstract class Version extends Encryptable {
  owner: string;
  createdAt: string;

  constructor(versionProto: any, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = versionProto.owner;
    this.createdAt = versionProto.createdAt;
  }
}

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
    return this.resourceUri
      ?.find(uri => uri.startsWith(type))
      ?.replace(type, "");
  }
}

export class MemoVersion extends Encryptable implements Version {
  @encrypted() message: string;
  reactions?: Array<MemoReaction>;
  attachments?: Array<FileVersion>;
  owner: string;
  createdAt: string;

  constructor(memoVersionProto: any, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = memoVersionProto.owner;
    this.createdAt = memoVersionProto.createdAt;
    this.message = memoVersionProto.message;
    this.reactions = (memoVersionProto.reactions || []).map((reaction: MemoReaction) =>
      new MemoReaction(reaction, keys, publicKey)
    );
    this.attachments = (memoVersionProto.attachments || []).map((attachment: FileVersion) => new FileVersion(attachment, keys));
  }
}

export class MemoReaction extends Encryptable {
  @encrypted() reaction: string;
  owner: string;
  createdAt: string;

  constructor(memoReactionProto: any, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = memoReactionProto.owner;
    this.createdAt = memoReactionProto.createdAt;
    this.reaction = memoReactionProto.reaction;
  }
}

export type NodeLike = Folder | Stack | Note | Memo

export class NodeFactory {
  static instance<NodeLike, K extends Node>(nodeLike: { new(raw: K, keys: Array<EncryptedKeys>): NodeLike }, data: K, keys: Array<EncryptedKeys>): any {
    return new nodeLike(data, keys);
  }
}

export enum StorageType {
  S3 = "s3:",
  ARWEAVE = "arweave:"
}
