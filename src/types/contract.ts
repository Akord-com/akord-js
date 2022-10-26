import { Membership } from "./membership";
import { Folder, Memo, Note, Stack } from "./node";

export interface Contract {
  state: ContractState
}

export interface ContractState {
  id: string;
  owner: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  public: boolean;
  admin?: string;
  data?: string[];
  memberships: Array<Membership>;
  folders: Array<Folder>;
  stacks: Array<Stack>;
  notes: Array<Note>;
  memos: Array<Memo>;
}
