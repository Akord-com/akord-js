import { Encryptable, encrypted } from "@akord/crypto";
import { functions } from "../constants";
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
  constructor(name: string, value: any) {
    return {
      name: name,
      value: value.toString()
    }
  }
}

export type Tags = Tag[];

export interface ContractInput {
  function: functions,
  data?: DataInput,
  parentId?: string,
  address?: string,
  role?: string // type
}

export type DataInput =
  { vault: string, membership: string } // vault:init
  | { id: string, value: string }[] // membership:revoke
  | string // all other transactions