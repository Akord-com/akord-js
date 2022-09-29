import { AWSConfig } from './akord/aws-config';
import { ArweaveConfig } from './arweave/arweave-config';
import { LedgerVersion } from '../client-config';
import { Contract } from '../model/contract';

abstract class Api {
  getMembershipKeys(vaultId: string, wallet: any): Promise<any> {
    throw new Error("Method not implemented.");
  }

  getProfileByPublicSigningKey(signingPublicKey: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  getObject(objectId: string, objectType: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  getNodeState(objectId: string, objectType: string, vaultId?: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  postLedgerTransaction(transactions: any): Promise<any> {
    throw new Error("Method not implemented.");
  }

  preInviteCheck(emails: string[], dataRoomId: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  getVaults(wallet: any): Promise<any> {
    throw new Error("Method not implemented.");
  }

  getMemberships(wallet: any): Promise<any> {
    throw new Error("Method not implemented.");
  }

  getObjectsByVaultId(vaultId: string, objectType: string): Promise<any> {
    throw new Error("Method not implemented.");
  }

  getLedgerVersion(vault: any): LedgerVersion {
    return LedgerVersion.V2;
  }

  config: AWSConfig | ArweaveConfig
  jwtToken: string

  constructor() { }

  abstract postContractTransaction(contractId: string, input: any, tags: any, metadata?: any): Promise<string>

  abstract initContractId(tags: any): Promise<string>

  abstract getUserFromEmail(email: string): Promise<any>

  abstract getPublicKeyFromAddress(address: string): Promise<string>

  abstract uploadFile(file: any, tags: any, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<any>

  abstract uploadData(data: any[], shouldBundleTransaction?: boolean): Promise<any[]>

  abstract getContractState(objectId: string): Promise<Contract>

  abstract downloadFile(id: string, isPublic?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<any>

  public getConfig() {
    return this.config;
  }
}

export {
  Api
}
