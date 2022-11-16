import { AWSConfig } from './akord/aws-config';
import { ArweaveConfig } from './arweave/arweave-config';
import { ContractState } from '../types/contract';
import { Keys } from '@akord/crypto';
import { Vault } from '../types/vault';
import { Membership } from '../types/membership';

abstract class Api {
  config: AWSConfig | ArweaveConfig
  jwtToken: string

  constructor() { }

  abstract postContractTransaction(contractId: string, input: any, tags: any, metadata?: any): Promise<string>

  abstract initContractId(tags: any, state?: any): Promise<string>

  abstract getUserFromEmail(email: string): Promise<{ address: string, publicKey: string }>

  abstract uploadFile(file: any, tags: any, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<any>

  abstract uploadData(data: any[], shouldBundleTransaction?: boolean): Promise<any[]>

  abstract getContractState(vaultId: string): Promise<ContractState>

  abstract downloadFile(id: string, isPublic?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController, numberOfChunks?: number, loadedSize?: number, resourceSize?: number): Promise<any>

  abstract getMembershipKeys(vaultId: string, wallet: any): Promise<{ isEncrypted: boolean, keys: Array<Keys>, publicKey?: string }>

  abstract getProfile(wallet: any): Promise<any>

  abstract getObject<T>(objectId: string, objectType: string, vaultId?: string): Promise<T>

  abstract getNodeState(stateId: string): Promise<any>

  abstract getVaults(wallet: any): Promise<Array<Vault>>

  abstract getMemberships(wallet: any): Promise<Array<Membership>>

  abstract getObjectsByVaultId<T>(vaultId: string, objectType: string): Promise<Array<T>>

  abstract preInviteCheck(emails: any[], vaultId: string): Promise<Array<{ address: string, publicKey: string, membership: Membership}>>

  public getConfig() {
    return this.config;
  }

  // legacy calls
  postLedgerTransaction(transactions: any[]): Promise<any> {
    throw new Error("Method not implemented.");
  }
}

export {
  Api
}
