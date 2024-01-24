import { AssetMetadata } from "./asset";
import { Node, StorageType } from "./node";
import { FileVersion } from "../types";
import { FileSource } from "./file";

export class NFT extends Node {
  ticker: string;
  name: string;
  description: string;
  collection: string;
  creator: string;
  owner: string;
  balances: {
    [x: string]: number;
  }
  claimable: Claim[];
  asset: FileVersion;
  thumbnail?: FileVersion;
  uri: string; // asset arweave uri

  constructor(nodeLike: any) {
    super(nodeLike, null);
    this.ticker = nodeLike.ticker;
    this.name = nodeLike.name;
    this.description = nodeLike.description;
    this.collection = nodeLike.collection;
    this.creator = nodeLike.creator;
    this.balances = nodeLike.balances;
    this.claimable = nodeLike.claimable;
    this.asset = new FileVersion(nodeLike.asset);
    this.thumbnail = nodeLike.thumbnail ? new FileVersion(nodeLike.thumbnail) : undefined;
    this.uri = this.getUri();
  }

  getUri(type: StorageType = StorageType.ARWEAVE): string {
    return this.asset.getUri(type);
  }
}

export type Claim = {
  from: string
  qty: number
  to: string
  txID: string
}

export type NFTMetadata = {
  owner?: string // NFT owner address
  creator?: string, // NFT creator address, if not present, default to owner
  collection?: string // NFT collection code
  contractTxId?: string, // default to "Of9pi--Gj7hCTawhgxOwbuWnFI1h24TTgO5pw8ENJNQ"
  ticker?: string, // default to "ATOMIC"
  thumbnail?: FileSource,
} & AssetMetadata