import { Encrypter, Wallet } from "@akord/crypto"
import { Api } from "../api"
import { reactionEmoji } from "../constants";

export interface ServiceInterface {
  isPublic: any;
  vault: any;
  setIsPublic(isPublic: boolean): void
  processReadObject(state: any, arg1: string[]): any
  processReadRaw(fileData: any, headers: any): any
  setKeys(keys: any): void
  setVaultId(vaultId: any): void
  setVault(vault: any): void
  setObject(object: any): void
  setObjectId(objectId: any): void
  setObjectType(objectType: any): void
  setPrevHash(hash: any): void
  setCommand(command: any): void
  setActionRef(actionRef: any): void
  setGroupRef(groupRef: any): void

  wallet: Wallet
  api: Api
  dataEncrypter: Encrypter
  keysEncrypter: Encrypter

  vaultCreate(name: string, termsOfAccess: string, memberDetails: any, isPublic?: boolean): Promise<{ vaultId: string, membershipId: string, transactionId: string }>
  vaultArchive(): Promise<{ transactionId: string }>

  membershipInvite(email: string, role: string): Promise<{ membershipId: string, transactionId: string }>
  membershipAccept(memberDetails: any): Promise<{ transactionId: string }>
  membershipReject(): Promise<{ transactionId: string }>
  membershipRevoke(): Promise<{ transactionId: string }>
  membershipChangeRole(role: string): Promise<{ transactionId: string }>
  membershipConfirm(): Promise<{ transactionId: string }>

  nodeRevoke(): Promise<{ transactionId: string }>
  nodeRestore(): Promise<{ transactionId: string }>
  nodeDelete(): Promise<{ transactionId: string }>
  nodeMove(parentId?: string): Promise<{ transactionId: string }>
  nodeRename(name: string): Promise<{ transactionId: string }>

  folderCreate(name: string, parentId?: string): Promise<{ folderId: string, transactionId: string }>

  stackCreate(name: string, file: any, parentId?: string, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{ stackId: string, transactionId: string }>
  stackUploadRevision(file: any, progressHook?: (progress: number) => void): Promise<{ transactionId: string }>

  noteCreate(name: string, content: string, parentId?: string): Promise<{ noteId: string, transactionId: string }>
  noteUploadRevision(name: string, content: string): Promise<{ transactionId: string }>

  memoCreate(message: string): Promise<{ memoId: string, transactionId: string }>
  memoAddReaction(reaction: reactionEmoji, author: string): Promise<{ transactionId: string }>
  memoRemoveReaction(reaction: reactionEmoji): Promise<{ transactionId: string }>

  membershipProfileUpdate(name: string, avatar: any): Promise<{ transactionId: string }>

  getProfileDetails(): Promise<any>

  // functions supported only in ledger service
  profileUpdate(name: string, avatar: any): Promise<{ transactionId: string }>
  membershipInviteNewUser(email: string, role: string): Promise<{ membershipId: string, transactionId: string }>
  membershipInviteNewUserResend(): Promise<{ transactionId: string }>
  membershipInviteResend(): Promise<{ transactionId: string }>
  vaultDelete(): Promise<{ transactionId: string }>
}
