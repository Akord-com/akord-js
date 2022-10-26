import { AWSConfig } from './akord/aws-config';
import { ArweaveConfig } from './arweave/arweave-config';
import { ContractState } from '../model/contract';

abstract class Api {
  config: AWSConfig | ArweaveConfig
  jwtToken: string

  constructor() { }

  abstract postContractTransaction(contractId: string, input: any, tags: any, metadata?: any): Promise<string>

  abstract initContractId(tags: any): Promise<string>

  abstract getUserFromEmail(email: string): Promise<any>

  abstract getPublicKeyFromAddress(address: string): Promise<string>

  abstract uploadFile(file: any, tags: any, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<any>

  abstract uploadData(data: any[], shouldBundleTransaction?: boolean): Promise<any[]>

  abstract getContractState(vaultId: string): Promise<ContractState>

  abstract downloadFile(id: string, isPublic?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<any>

  abstract getMembershipKeys(vaultId: string, wallet: any): Promise<any>

  abstract getProfileByPublicSigningKey(signingPublicKey: string): Promise<any>

  abstract getObject(objectId: string, objectType: string): Promise<any>

  abstract getNodeState(stateId: string): Promise<any>

  abstract getVaults(wallet: any): Promise<any>

  abstract getMemberships(wallet: any): Promise<any>

  abstract getObjectsByVaultId(vaultId: string, objectType: string): Promise<any>

  public getConfig() {
    return this.config;
  }

  // legacy calls
  postLedgerTransaction(transactions: any[]): Promise<any> {
    throw new Error("Method not implemented.");
  }
  preInviteCheck(emails: any[], vaultId: string) {
    throw new Error("Method not implemented.");
  }
}

export {
  Api
}
