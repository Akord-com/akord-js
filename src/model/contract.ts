import { Membership } from "./membership";
import { Folder, Memo, Note, Stack } from "./node";

export interface Contract {
  state: ContractState
}

export interface ContractState {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  data?: string[];
  public: boolean;
  memberships: Array<Membership>;
  folders: Array<Folder>;
  stacks: Array<Stack>;
  notes: Array<Note>;
  memos: Array<Memo>;
}
