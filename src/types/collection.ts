import { AssetMetadata } from "./asset";
import { Node } from "./node";
import { UDL } from "../types";
import { FileSource } from "./file";

export class Collection extends Node {
  name: string;
  description: string;
  code: string;
  creator: string;
  owner: string;
  bannerUri: string[];
  thumbnailUri: string[];
  udl?: UDL;
  ucm?: boolean;
  items: string[];

  constructor(collectionProto: any) {
    super(collectionProto, null);
    this.name = collectionProto.name;
    this.description = collectionProto.description;
    this.code = collectionProto.code;
    this.creator = collectionProto.creator;
    this.owner = collectionProto.owner;
    this.bannerUri = collectionProto.bannerUri;
    this.thumbnailUri = collectionProto.thumbnailUri;
    this.udl = collectionProto.udl;
    this.ucm = collectionProto.ucm;
    this.items = collectionProto.items;
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