import { Encryptable, encrypted, EncryptedKeys } from "@akord/crypto";
import { Node, Version } from "./node";

export class Memo extends Node {
  versions: Array<MemoVersion>;

  constructor(nodeLike: any, keys: Array<EncryptedKeys>, publicKey?: string) {
    super(nodeLike, keys);
    this.versions = (nodeLike.versions || []).map((version: MemoVersion) => new MemoVersion(version, keys, publicKey));
  }

  getVersion(index?: number): MemoVersion {
    return super.getVersion(index) as MemoVersion;
  }
}

export class MemoVersion extends Encryptable implements Version {
  @encrypted() message: string;
  reactions?: Array<MemoReaction>;
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

export type MemoCreateResult = {
  memoId: string,
  transactionId: string,
  object: Memo
}

export type MemoUpdateResult = {
  transactionId: string,
  object: Memo
}