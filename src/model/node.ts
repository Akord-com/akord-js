export interface Node {
    id: string;
    hash: string;
    name: string;
    modifiedAt: string;
    version: number;
    status: string;
    size?: number;
    folderId?: string;
}

export interface Folder extends Node { }

export interface Stack extends Node {
    files: Array<StackFile>;
}

export interface StackFile {
    hash: string;
    name: string;
    type: string;
    resourceUrl: string;
    resourceTx: string;
    thumbnailUrl: string;
    thumbnailTx: string;
    size: number;
    numberOfChunks: number;
    chunkSize: number;
    postedAt: string;
    modifiedAt: string;
}

export interface Note extends Node {
    revisions: Array<NoteRevision>;
}

export interface NoteRevision {
    hash: string;
    title: string;
    fileType: string;
    resourceUrl: string;
    resourceTx: string;
    thumbnailUrl: string;
    thumbnailTx: string;
    size: number;
    numberOfChunks: number;
    chunkSize: number;
    postedAt: string;
    modifiedAt: string;
}

export interface Memo extends Node {
    message: string
    reactions: MemoReaction
}

export interface MemoReaction {
    publicSigningKey: string;
    name: string;
    reaction: string;
    status: string;
    postedAt: string;
    refHash: string;
}
