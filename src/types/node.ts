import { Encryptable, encrypted, Keys } from "@akord/crypto";
import { status } from "../constants";

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

  constructor(id: string, createdAt: string, updatedAt: string, status: status, vaultId: string, owner: string, data: Array<string>, parentId: string, keys?: Array<Keys>, publicKey?: string) {
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
}

export class Folder extends Node {
  @encrypted() name: string;

  constructor(nodeLike: any, keys: Array<Keys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys);
    this.name = nodeLike.name;
  }
}

export class Stack extends Node {
  @encrypted() name: string;
  versions: Array<FileVersion>;

  constructor(nodeLike: any, keys: Array<Keys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys);
    this.name = nodeLike.name;
    this.versions = (nodeLike.versions || []).map((version: FileVersion) => new FileVersion(version, keys));
  }
}

export class Note extends Node {
  @encrypted() name: string;
  versions: Array<FileVersion>;

  constructor(nodeLike: any, keys: Array<Keys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys);
    this.name = nodeLike.name;
    this.versions = (nodeLike.versions || []).map((version: FileVersion) => new FileVersion(version, keys));
  }
}

export class Memo extends Node {
  versions: Array<MemoVersion>;

  constructor(nodeLike: any, keys: Array<Keys>, publicKey?: string) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys, publicKey);
    this.versions = (nodeLike.versions || []).map((version: MemoVersion) => new MemoVersion(version, keys, publicKey));
  }
}

export class FileVersion extends Encryptable {
  @encrypted() name: string;
  owner: string;
  type: string; //type
  resourceUri: string[];
  size: number;
  createdAt: string;
  numberOfChunks?: number;
  chunkSize?: number;

  constructor(fileVersionProto: any, keys?: Array<Keys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = fileVersionProto.owner;
    this.type = fileVersionProto.type;
    this.resourceUri = fileVersionProto.resourceUri;
    this.createdAt = fileVersionProto.createdAt;
    this.size = fileVersionProto.size;
    this.numberOfChunks = fileVersionProto.numberOfChunks;
    this.chunkSize = fileVersionProto.chunkSize;
    this.name = fileVersionProto.name;
    this.status = fileVersionProto.status;
  }

  getUri(type: StorageType) {
    return this.resourceUri
      ?.find(uri => uri.startsWith(type))
      ?.replace(type, "");
  }
}

export class MemoVersion extends Encryptable {
  @encrypted() message: string;
  owner: string;
  createdAt: string;
  reactions?: Array<MemoReaction>;
  attachments?: Array<FileVersion>;

  constructor(memoVersionProto: any, keys?: Array<Keys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = memoVersionProto.owner;
    this.createdAt =  memoVersionProto.createdAt;
    this.message =  memoVersionProto.message;
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

  constructor(memoReactionProto: any, keys?: Array<Keys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = memoReactionProto.owner;
    this.createdAt = memoReactionProto.createdAt;
    this.reaction = memoReactionProto.reaction;
  }
}

export type NodeLike = Folder | Stack | Note | Memo

export class NodeFactory {
  static instance<NodeLike, K extends Node>(nodeLike: { new(raw: K, keys: Array<Keys>): NodeLike }, data: K, keys: Array<Keys>): any {
    return new nodeLike(data, keys);
  }
}

export enum StorageType {
  S3 = "s3:",
  ARWEAVE = "arweave:"
}
