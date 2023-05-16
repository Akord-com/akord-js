import { Encryptable, encrypted, EncryptedKeys } from "@akord/crypto";
import { Membership } from "./membership";
import { Folder, Memo, NodeLike, Stack } from "./node";

export class Vault extends Encryptable {
  id: string;
  status: string;
  public: boolean;
  createdAt: string;
  updatedAt: string;
  owner: string;
  data: Array<string>;
  size?: number;
  cacheOnly?: boolean;
  tags?: string[];
  termsOfAccess?: string;
  @encrypted() name: string;
  @encrypted() description?: string;

  memberships?: Array<Membership>;
  memos?: Array<Memo>;
  stacks?: Array<Stack>;
  folders?: Array<Folder>;
  nodes?: Array<NodeLike>;

  constructor(vaultProto: any, keys: Array<EncryptedKeys>) {
    super(keys, null);
    this.id = vaultProto.id;
    this.public = vaultProto.public;
    this.createdAt = vaultProto.createdAt;
    this.updatedAt = vaultProto.updatedAt;
    this.size = vaultProto.size;
    this.name = vaultProto.name;
    this.description = vaultProto.description;
    this.termsOfAccess = vaultProto.termsOfAccess;
    this.tags = vaultProto.tags;
    this.status = vaultProto.status;
    this.data = vaultProto.data;
    this.cacheOnly = vaultProto.cacheOnly;
    this.tags = vaultProto.tags;
    this.keys = keys;
    this.memberships = vaultProto?.memberships?.map((membership: Membership) => new Membership(membership, keys));
    this.memos = vaultProto?.memos?.map((memo: Memo) => new Memo(memo, keys));
    this.stacks = vaultProto?.stacks?.map((stack: Stack) => new Stack(stack, keys));
    this.folders = vaultProto?.folders?.map((folder: Folder) => new Folder(folder, keys));
  }
}
