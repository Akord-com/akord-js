export interface Node {
  id: string;
  owner: string; // owner's address
  createdAt: number;
  updatedAt: number;
  status: string;
  parentId?: string;
  name: string;
  tags: string[];
}

export interface Folder extends Node { }

export interface Stack extends Node {
  versions: Array<FileVersion>;
}

export interface FileVersion {
  owner: string;
  name: string;
  type: string;
  resourceUri: string[];
  size: number;
  numberOfChunks: number;
  chunkSize: number;
  createdAt: number;
}

export interface Note extends Node {
  versions: Array<FileVersion>;
}

export interface Memo extends Node {
  versions: Array<MemoVersion>;
}

export interface MemoVersion {
  owner: string;
  reactions: Array<MemoReaction>;
  message: string;
  createdAt: number;
  attachments: Array<FileVersion>
}

export interface MemoReaction {
  owner: string;
  reaction: string;
  createdAt: number;
}
