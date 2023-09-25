import { AssetType } from "./asset";
import { FileVersion, Node } from "./node";

export class NFT extends Node {
  ticker: string;
  name: string;
  description: string;
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
    this.creator = nodeLike.creator;
    this.balances = nodeLike.balances;
    this.claimable = nodeLike.claimable;
    this.asset = nodeLike.asset;
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
  type: AssetType,
  name: string, // max 150 characters

  creator?: string, // NFT creator address, if not present, default to owner

  description?: string, // optional description, max 300 characters
  topics?: string[],
  collection?: string // NFT collection code

  contractTxId?: string, // default to "foOzRR7kX-zGzD749Lh4_SoBogVefsFfao67Rurc2Tg"
  ticker?: string, // default to "ATOMIC"
}