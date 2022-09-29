import { Folder, Memo, Note, Stack } from "./node";

export interface Contract {
    id: string;
    name: string;
    status: string;
    modifiedAt: string;
    size: number;
    isPublic: boolean;
    folders: Array<Folder>;
    stacks: Array<Stack>;
    notes: Array<Note>;
    memos: Array<Memo>;
  }
