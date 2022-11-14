import { Encryptable, encrypted, Keys } from "@akord/crypto";

export abstract class Node extends Encryptable {
  id: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  vaultId: string;
  parentId?: string;
  tags: string[];

  constructor(id: string, createdAt: string, updatedAt: string, status: string, vaultId: string, owner: string, keys: Array<Keys>) {
    super(keys, null);
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.status = status;
    this.vaultId = vaultId;
  }
}

export class Folder extends Node {
  @encrypted() name: string;
  parentId: string;
  
  constructor(nodeLike: any, keys: Array<Keys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.dataRoomId, nodeLike.owner, keys);
    this.name = nodeLike.name;
    this.parentId = nodeLike.parentId;
  }
}

export class Stack extends Node {
  @encrypted() name: string;
  parentId: string;
  versions: Array<FileVersion>;

  constructor(nodeLike: any, keys: Array<Keys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.dataRoomId, nodeLike.owner, keys);
    this.name = nodeLike.name;
    this.parentId = nodeLike.parentId;
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
        keys
      ));
  }
}

export class Note extends Node {
  @encrypted() name: string;
  parentId: string;
  versions: Array<FileVersion>;

  constructor(nodeLike: any, keys: Array<Keys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.dataRoomId, nodeLike.owner, keys);
    this.name = nodeLike.name;
    this.parentId = nodeLike.parentId;
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
        keys
      ));
  }
}

export class Memo extends Node {
  versions: Array<MemoVersion>;

  constructor(nodeLike: any, keys: Array<Keys>) {
    super(nodeLike.id, nodeLike.createdAt, nodeLike.updatedAt, nodeLike.status, nodeLike.dataRoomId, nodeLike.owner, keys);
    this.versions = (nodeLike.versions || []).map(version =>
      new MemoVersion(
        version.owner,
        version.reactions,
        version.attachments,
        version.createdAt,
        version.message,
        keys
      )
    );
  }
}

export class FileVersion extends Encryptable {
  @encrypted() name: string;
  owner: string;
  type: string;
  resourceUri: string[];
  size: number;
  numberOfChunks: number;
  chunkSize: number;
  createdAt: number;

  constructor(name: string, owner: string, type: string, resourceUri: string[], size: number, numberOfChunks: number, chunkSize: number, createdAt: number, keys: Array<Keys>) {
    super(keys, null);
    this.owner = owner;
    this.type = type;
    this.resourceUri = resourceUri;
    this.createdAt = createdAt;
    this.size = size;
    this.numberOfChunks = numberOfChunks;
    this.chunkSize = chunkSize;
    this.name = name;
  }
}

export class NoteVersion extends Encryptable {
  @encrypted() content: string;
  @encrypted() name: string;
  createdAt: string;
  size: number;

  constructor(name: string, content: string, size: number, createdAt: string, keys: Array<Keys>) {
    super(keys, null);
    this.name = name;
    this.content = content;
    this.size = size;
    this.createdAt = createdAt;
  }
}

export class MemoVersion extends Encryptable {
  @encrypted() message: string;
  owner: string;
  reactions?: Array<MemoReaction>;
  createdAt: number;
  attachments?: Array<FileVersion>;

  constructor(owner: string, reactions: Array<any>, attachments: Array<any>, createdAt: number, message: string, keys: Array<Keys>) {
    super(keys, null);
    this.owner = owner;
    this.createdAt = createdAt;
    this.message = message;
    this.reactions = (reactions || []).map(reaction =>
      new MemoReaction(
        reaction.owner,
        reaction.createdAt,
        reaction.reaction,
        keys
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
        keys
      )
    );
  }
}

export class MemoReaction extends Encryptable {
  @encrypted() reaction: string;
  owner: string;
  createdAt: number;

  constructor(owner: string, createdAt: number, reaction: string, keys: Array<Keys>) {
    super(keys, null);
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
