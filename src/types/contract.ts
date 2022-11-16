import { Encryptable, encrypted } from "@akord/crypto";
import { Membership } from "./membership";
import { Folder, Memo, Note, Stack, NodeLike } from "./node";

export interface Contract {
  state: ContractState
}

export class ContractState extends Encryptable {
  @encrypted() name: string;
  id: string;
  owner: string;
  status: string;
  createdAt: string; // number
  updatedAt: string;  // number
  public: boolean;
  admin?: string;
  data?: string[];
  memberships: Array<Membership>;
  folders: Array<Folder>;
  stacks: Array<Stack>;
  notes: Array<Note>;
  memos: Array<Memo>;
  nodes: Array<NodeLike>;
}

export type Tag = {
  name: string,
  value: string
};

export type Tags = Tag[];