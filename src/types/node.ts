import { Encryptable, encrypted, Keys } from "@akord/crypto";
import { status } from "../constants";

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
    this.versions = (nodeLike.versions || []).map(version =>
      new FileVersion(
        version.name,
        version.owner,
        version.type,
        version.resourceUri,
        version.size,
        version.numberOfChunks,
        version.chunkSize,
        version.createdAt,
        version.status,
        keys
      ));
  }
}

export class Note extends Node {
  @encrypted() name: string;
  versions: Array<FileVersion>;

  constructor(nodeLike: any, keys: Array<Keys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys);
    this.name = nodeLike.name;
    this.versions = (nodeLike.versions || []).map(version =>
      new FileVersion(
        version.name,
        version.owner,
        version.type,
        version.resourceUri,
        version.size,
        version.numberOfChunks,
        version.chunkSize,
        version.createdAt,
        version.status,
        keys
      ));
  }
}

export class Memo extends Node {
  versions: Array<MemoVersion>;

  constructor(nodeLike: any, keys: Array<Keys>, publicKey?: string) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.vaultId, nodeLike.owner, nodeLike.data, nodeLike.parentId, keys, publicKey);
    this.versions = (nodeLike.versions || []).map(version =>
      new MemoVersion(
        version.owner,
        version.reactions,
        version.attachments,
        version.createdAt,
        version.message,
        keys,
        publicKey
      )
    );
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

  constructor(name: string, owner: string, type: string, resourceUri: string[], size: number, numberOfChunks: number, chunkSize: number, createdAt: string, status: string, keys?: Array<Keys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = owner;
    this.type = type;
    this.resourceUri = resourceUri;
    this.createdAt = createdAt;
    this.size = size;
    this.numberOfChunks = numberOfChunks;
    this.chunkSize = chunkSize;
    this.name = name;
    this.status = status;
  }
}

export class MemoVersion extends Encryptable {
  @encrypted() message: string;
  owner: string;
  createdAt: string;
  reactions?: Array<MemoReaction>;
  attachments?: Array<FileVersion>;

  constructor(owner: string, reactions: Array<any>, attachments: Array<any>, createdAt: string, message: string, keys?: Array<Keys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = owner;
    this.createdAt = createdAt;
    this.message = message;
    this.reactions = (reactions || []).map(reaction =>
      new MemoReaction(
        reaction.owner,
        reaction.createdAt,
        reaction.reaction,
        keys,
        publicKey
      )
    );
    this.attachments = (attachments || []).map(attachment =>
      new FileVersion(
        attachment.name,
        attachment.owner,
        attachment.type,
        attachment.resourceUri,
        attachment.size,
        attachment.numberOfChunks,
        attachment.chunkSize,
        attachment.createdAt,
        attachment.status,
        keys
      )
    );
  }
}

export class MemoReaction extends Encryptable {
  @encrypted() reaction: string;
  owner: string;
  createdAt: string;

  constructor(owner: string, createdAt: string, reaction: string, keys?: Array<Keys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = owner;
    this.createdAt = createdAt;
    this.reaction = reaction;
  }
}

export type NodeLike = Folder | Stack | Note | Memo

export class NodeFactory {
  static instance<NodeLike, K extends Node>(nodeLike: { new (raw: K, keys: Array<Keys>): NodeLike }, data: K, keys: Array<Keys>): any {
    return new nodeLike(data, keys);
  }
}
