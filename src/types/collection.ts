import { AssetMetadata } from "./asset";
import { Node } from "./node";
import { FileVersion, UDL } from "../types";
import { FileSource } from "./file";

export class Collection extends Node {
  name: string;
  description: string;
  code: string;
  creator: string;
  owner: string;
  banner: FileVersion;
  thumbnail?: FileVersion;
  udl?: UDL;
  ucm?: boolean;
  items: string[];
  type: string;

  constructor(collectionProto: any) {
    super(collectionProto, null);
    this.name = collectionProto.name;
    this.description = collectionProto.description;
    this.code = collectionProto.code;
    this.creator = collectionProto.creator;
    this.owner = collectionProto.owner;
    this.banner = new FileVersion(collectionProto.banner);
    this.thumbnail = collectionProto.thumbnail ? new FileVersion(collectionProto.thumbnail) : undefined;
    this.udl = collectionProto.udl;
    this.ucm = collectionProto.ucm;
    this.items = collectionProto.items;
    this.type = collectionProto.type;
  }
}

export type CollectionMetadata = {
  owner: string // NFT owner address
  creator?: string, // NFT creator address, if not present, default to owner
  code?: string // NFT collection code
  contractTxId?: string, // default to "Of9pi--Gj7hCTawhgxOwbuWnFI1h24TTgO5pw8ENJNQ"
  banner?: FileSource,
  thumbnail?: FileSource,
} & AssetMetadata