export interface Node {
  id: string;
  owner: string; // owner's address
  createdAt: number;
  updatedAt: number;
  status: string;
  parentId?: string;
}

export interface Folder extends Node {
  name: string;
}

export interface Stack extends Node {
  files: Array<StackFile>;
}

export interface StackFile {
  name: string;
  type: string;
  resourceUrl: string;
  resourceTx: string;
  thumbnailUrl: string;
  thumbnailTx: string;
  size: number;
  numberOfChunks: number;
  chunkSize: number;
  createdAt: number;
  updatedAt: number;
}

export interface Note extends Node {
  revisions: Array<NoteRevision>;
}

export interface NoteRevision {
  owner: string;
  name: string;
  content: string;
  size: number;
  createdAt: number;
}

export interface Memo extends Node {
  message: string;
  reactions: MemoReaction;
}

export interface MemoReaction {
  owner: string;
  author: string;
  reaction: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}
