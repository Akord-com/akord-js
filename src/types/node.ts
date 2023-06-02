import { Encryptable, EncryptedKeys } from "@akord/crypto";
import { status } from "../constants";
import { NotFound } from "../errors/not-found";
import { Folder } from "./folder";
import { Stack } from "./stack";
import { Note } from "./note";
import { Memo } from "./memo";
import { Tags } from "./contract";

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
  tags?: string[];

  // vault context
  __public__?: boolean;
  __cacheOnly__?: boolean;

  constructor(nodeLikeProto: any, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.id = nodeLikeProto.id;
    this.createdAt = nodeLikeProto.createdAt;
    this.updatedAt = nodeLikeProto.updatedAt;
    this.status = nodeLikeProto.status;
    this.vaultId = nodeLikeProto.vaultId;
    this.owner = nodeLikeProto.owner;
    this.data = nodeLikeProto.data;
    this.parentId = nodeLikeProto.parentId;
    this.tags = nodeLikeProto.tags;
    this.__public__ = nodeLikeProto.__public__;
    this.__cacheOnly__ = nodeLikeProto.__cacheOnly__;
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

export abstract class Version extends Encryptable {
  owner: string;
  createdAt: string;

  constructor(versionProto: any, keys?: Array<EncryptedKeys>, publicKey?: string) {
    super(keys, publicKey);
    this.owner = versionProto.owner;
    this.createdAt = versionProto.createdAt;
  }
}

export type NodeLike = Folder | Stack | Note | Memo

export class NodeFactory {
  static instance<NodeLike, K extends Node>(nodeLike: { new(raw: K, keys: Array<EncryptedKeys>): NodeLike }, data: K, keys: Array<EncryptedKeys>): any {
    return new nodeLike(data, keys);
  }
}

export type NodeUpdateResult = {
  transactionId: string,
  object: NodeLike
}

export type NodeCreateOptions = {
  parentId?: string,
  tags?: string[],
  arweaveTags?: Tags
}

