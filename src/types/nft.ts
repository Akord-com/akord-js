import { AssetMetadata } from "./asset";
import { Node, StorageType } from "./node";
import { FileVersion, Tag, UDL } from "../types";
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
    const uri = this.asset?.getUri(type);
    return uri ? uri : this.asset?.getUri(StorageType.S3);
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
  fractional?: boolean, // allow multiple collectors to own fractions of the same Atomic NFT
  fractionParts?: number // used when fractional option is set to true, default to 100
} & AssetMetadata

export type NFTMintOptions = {
  parentId?: string,
  arweaveTags?: Tag[],
  udl?:UDL
  ucm?: boolean
};