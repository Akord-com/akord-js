import { encrypted, EncryptedKeys } from "@akord/crypto";
import { Node, NodeCreateOptions } from "./node";
import { FileVersion } from "./file";
import { Stack } from "./stack";

export class Note extends Node {
  @encrypted() name: string;
  versions: Array<FileVersion>;

  constructor(nodeLike: any, keys: Array<EncryptedKeys>) {
    super(nodeLike, keys);
    this.name = nodeLike.name;
    this.versions = (nodeLike.versions || []).map((version: FileVersion) => new FileVersion(version, keys));
  }
}

export enum NoteTypes {
  MD = "text/markdown",
  JSON = "application/json"
}

export type NoteCreateResult = {
  noteId: string,
  transactionId: string,
  object: Stack
}

export type NoteUpdateResult = {
  transactionId: string,
  object: Stack
}

export type NoteType = "text/markdown" | "application/json";

export type NoteOptions = {
  mimeType?: string
}

export type NoteCreateOptions = NodeCreateOptions & NoteOptions