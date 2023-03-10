import { ContractInput, ContractState, Tags } from "../types/contract";
import { Vault } from "../types/vault";
import { Membership, MembershipKeys } from "../types/membership";
import { Paginated } from "../types/paginated";

abstract class Api {
  config: any
  jwtToken: string

  constructor() { }

  abstract postContractTransaction(contractId: string, input: ContractInput, tags: Tags, metadata?: any): Promise<string>

  abstract initContractId(tags: Tags, state?: any): Promise<string>

  abstract getUserFromEmail(email: string): Promise<{ address: string, publicKey: string }>

  abstract uploadFile(file: ArrayBufferLike, tags: Tags, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{ resourceTx: string, resourceUrl?: string }>

  abstract uploadData(items: { data: any, tags: Tags }[], shouldBundleTransaction?: boolean): Promise<Array<{ id: string, resourceTx: string }>>

  abstract getContractState(vaultId: string): Promise<ContractState>

  abstract downloadFile(id: string, isPublic?: boolean, progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController, numberOfChunks?: number, loadedSize?: number, resourceSize?: number): Promise<any>

  abstract getMembershipKeys(vaultId: string): Promise<MembershipKeys>

  abstract getProfile(): Promise<any>

  abstract getNode<T>(id: string, type: string, vaultId?: string): Promise<T>

  abstract getMembership(id: string, vaultId?: string): Promise<Membership>

  abstract getVault(id: string): Promise<Vault>

  abstract getNodeState(stateId: string): Promise<any>

  abstract getVaults(): Promise<Array<Vault>>

  abstract getMemberships(): Promise<Array<Membership>>

  abstract getNodesByVaultId<T>(vaultId: string, type: string, parentId?: string, filter?: Object, limit?: number, nextToken?: string): Promise<Paginated<T>>

  abstract getMembershipsByVaultId(vaultId: string, filter?: Object, limit?: number, nextToken?: string): Promise<Paginated<Membership>>

  abstract getMembers(vaultId: string): Promise<Array<Membership>>

  abstract getTransactions(vaultId: string): Promise<Array<any>>

  abstract updateProfile(name: string, avatarUri: string): Promise<void>

  abstract deleteVault(vaultId: string): Promise<void>

  abstract inviteNewUser(vaultId: string, email: string, role: string): Promise<{ id: string }>

  abstract inviteResend(vaultId: string, membershipId: string): Promise<{ id: string }>
}

export {
  Api
}