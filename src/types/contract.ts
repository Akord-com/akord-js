import { Membership } from "./membership";
import { Folder, Memo, Note, Stack } from "./node";

export interface Contract {
  state: {
    id: string;
    name: string;
    status: string;
    modifiedAt: string;
    owner: string;
    data?: string[];
    size: number;
    isPublic: boolean;
    memberships: Array<Membership>;
    folders: Array<Folder>;
    stacks: Array<Stack>;
    notes: Array<Note>;
    memos: Array<Memo>;
  }
}
