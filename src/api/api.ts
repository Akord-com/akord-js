import { ContractInput, ContractState, Tags } from "../types/contract";
import { Vault } from "../types/vault";
import { Membership, MembershipKeys } from "../types/membership";
import { Transaction } from "../types/transaction";

abstract class Api {
  config: any
  jwtToken: string

  constructor() { }

  abstract postContractTransaction<T>(contractId: string, input: ContractInput, tags: Tags): Promise<{ id: string, object: T }>

  abstract initContractId(tags: Tags, state?: any): Promise<string>

  abstract getUserFromEmail(email: string): Promise<{ address: string, publicKey: string }>

  abstract uploadFile(file: ArrayBufferLike, tags: Tags, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{ resourceTx: string, resourceUrl?: string }>

  abstract uploadData(items: { data: any, tags: Tags }[], shouldBundleTransaction?: boolean): Promise<Array<string>>

  abstract getContractState(vaultId: string): Promise<ContractState>

  abstract downloadFile(id: string, isPublic?: boolean, progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController, numberOfChunks?: number, loadedSize?: number, resourceSize?: number): Promise<any>

  abstract getMembershipKeys(vaultId: string): Promise<MembershipKeys>

  abstract getProfile(): Promise<any>

  abstract getObject<T>(id: string, type: string, vaultId?: string): Promise<T>

  abstract getNodeState(stateId: string): Promise<any>

  abstract getVaults(): Promise<Array<Vault>>

  abstract getMemberships(): Promise<Array<Membership>>

  abstract getObjectsByVaultId<T>(vaultId: string, type: string, shouldListAll?: boolean): Promise<Array<T>>

  abstract getMembers(vaultId: string): Promise<Array<Membership>>

  abstract getTransactions(vaultId: string): Promise<Array<Transaction>>

  abstract updateProfile(name: string, avatarUri: string): Promise<void>

  abstract deleteVault(vaultId: string): Promise<void>

  abstract inviteNewUser(vaultId: string, email: string, role: string): Promise<{ id: string }>

  abstract inviteResend(vaultId: string, membershipId: string): Promise<{ id: string }>
}

export {
  Api
}