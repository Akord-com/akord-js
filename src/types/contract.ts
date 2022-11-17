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

export class Tag {
  name: string;
  value: string;

  /**
   * @param name
   * @param value
   * @returns 
   */
  constructor(name: string, value: string) {
    return {
      name: name,
      value: value
    }
  }
}

export type Tags = Tag[];