import { AssetMetadata } from "./asset";
import { FileVersion, Node } from "./node";

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
  }
}

export type Claim = {
  from: string
  qty: number
  to: string
  txID: string
}

export type NFTMetadata = {
  owner: string // NFT owner address
  creator?: string, // NFT creator address, if not present, default to owner
  collection?: string // NFT collection code
  contractTxId?: string, // default to "foOzRR7kX-zGzD749Lh4_SoBogVefsFfao67Rurc2Tg"
  ticker?: string, // default to "ATOMIC"
} & AssetMetadata