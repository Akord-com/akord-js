import { ContractInput, ContractState, Tags } from "../types/contract";
import { Vault } from "../types/vault";
import { Membership, MembershipKeys } from "../types/membership";
import { Transaction } from "../types/transaction";
import { Paginated } from "../types/paginated";

abstract class Api {
  config: any

  constructor() { }

  abstract postContractTransaction<T>(contractId: string, input: ContractInput, tags: Tags): Promise<{ id: string, object: T }>

  abstract initContractId(tags: Tags, state?: any): Promise<string>
  
  abstract uploadFile(file: ArrayBufferLike, tags: Tags, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{ resourceTx: string, resourceUrl?: string }>

  abstract uploadData(items: { data: any, tags: Tags }[], shouldBundleTransaction?: boolean): Promise<Array<string>>

  abstract getContractState(vaultId: string): Promise<ContractState>

  abstract downloadFile(id: string, isPublic?: boolean, progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController, numberOfChunks?: number, loadedSize?: number, resourceSize?: number): Promise<any>

  abstract getMembershipKeys(vaultId: string): Promise<MembershipKeys>

  abstract existsUser(email: string): Promise<Boolean>

  abstract getUser(): Promise<any>

  abstract getUserPublicData(email: string): Promise<{address: string, publicKey: string}>

  abstract getNode<T>(id: string, type: string, vaultId?: string): Promise<T>

  abstract getMembership(id: string, vaultId?: string): Promise<Membership>

  abstract getVault(id: string): Promise<Vault>

  abstract getNodeState(stateId: string): Promise<any>

  abstract getVaults(filter?: Object, limit?: number, nextToken?: string): Promise<Paginated<Vault>>

  abstract getMemberships(limit?: number, nextToken?: string): Promise<Paginated<Membership>>

  abstract getNodesByVaultId<T>(vaultId: string, type: string, parentId?: string, filter?: Object, limit?: number, nextToken?: string): Promise<Paginated<T>>

  abstract getMembershipsByVaultId(vaultId: string, filter?: Object, limit?: number, nextToken?: string): Promise<Paginated<Membership>>

  abstract getMembers(vaultId: string): Promise<Array<Membership>>

  abstract getTransactions(vaultId: string): Promise<Array<Transaction>>

  abstract updateUser(name: string, avatarUri: string): Promise<void>

  abstract deleteVault(vaultId: string): Promise<void>

  abstract inviteNewUser(vaultId: string, email: string, role: string): Promise<{ id: string }>

  abstract inviteResend(vaultId: string, membershipId: string): Promise<{ id: string }>
}

export {
  Api
}