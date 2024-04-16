import { Hooks } from "../core/file";
import { Membership } from "./membership"
import { NFT } from "./nft";
import { Stack } from "./stack"

export type BatchStackCreateOptions = Hooks & {
  processingCountHook?: (count: number) => void,
  onStackCreated?: (item: Stack) => Promise<void>
};

export type BatchNFTMintOptions = Hooks & {
  processingCountHook?: (count: number) => void,
  onItemCreated?: (item: NFT) => Promise<void>
};

export interface BatchStackCreateResponse {
  data: Array<{ stackId: string, transactionId: string, object: Stack, uri: string }>
  errors: Array<{ name?: string, message: string, error: Error }>
  cancelled: number
}

export interface BatchNFTMintResponse {
  data: Array<{ nftId: string, transactionId: string, object: NFT, uri: string }>
  errors: Array<{ name?: string, message: string, error: Error }>
  cancelled: number
}

export interface BatchMembershipInviteResponse {
  data: Array<{ membershipId: string, transactionId: string, object?: Membership }>
  errors: Array<{ email: string, message: string, error: Error }>
}
