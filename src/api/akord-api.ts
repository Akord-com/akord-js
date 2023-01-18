import { Wallet } from "@akord/crypto";
import { ClientConfig } from "../config";
import { Api } from "./api";
import { apiConfig, ApiConfig } from "./config";
import { ApiClient } from "./api-client";
import { Logger } from "../logger";
import { Membership, MembershipKeys } from "../types/membership";
import { ContractInput, ContractState, Tags } from "../types/contract";
import { objectType } from "../constants";

export default class AkordApi extends Api {

  public config!: ApiConfig;
  public jwtToken: string;

  constructor(config: ClientConfig, jwtToken: string) {
    super();
    this.config = apiConfig(config.env);
    this.jwtToken = jwtToken;
  }

  public async uploadData(items: { data: any, tags: Tags, metadata?: any }[], shouldBundleTransaction?: boolean)
    : Promise<Array<{ id: string, resourceTx: string }>> {

    const resources = [];

    await Promise.all(items.map(async (item, index) => {
      const resource = await new ApiClient()
        .env(this.config)
        .auth(this.jwtToken)
        .data(item.data)
        .tags(item.tags)
        .bundle(shouldBundleTransaction)
        .metadata(item.metadata)
        .uploadState()
      Logger.log("Uploaded state with id: " + resource.id);
      resources[index] = resource;
    }));
    return resources;
  };

  public async postContractTransaction(contractId: string, input: ContractInput, tags: Tags, metadata?: any): Promise<string> {
    const txId = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .contractId(contractId)
      .input(input)
      .metadata(metadata ? metadata : {})
      .tags(tags)
      .transaction()
    Logger.log("Uploaded contract interaction with id: " + txId);
    return txId;
  };

  public async getMembers(vaultId: string): Promise<Array<any>> {
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(vaultId)
      .getMembers();
  };

  public async initContractId(tags: Tags, state?: any): Promise<string> {
    const contractId = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .tags(tags)
      .data(state)
      .contract()
    Logger.log("Created contract with id: " + contractId);
    return contractId;
  };

  public async getUserFromEmail(email: string): Promise<any> {
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(email)
      .getUser();
  };

  public async uploadFile(file: any, tags: Tags, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController): Promise<{ resourceUrl: string, resourceTx: string }> {
    const resource = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .data(file)
      .tags(tags)
      .public(isPublic)
      .bundle(shouldBundleTransaction)
      .progressHook(progressHook)
      .cancelHook(cancelHook)
      .uploadFile()
    Logger.log("Uploaded file with id: " + resource.id);

    return resource;
  };

  public async downloadFile(id: string, isPublic?: boolean, progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController, numberOfChunks?: number, loadedSize?: number, resourceSize?: number): Promise<any> {
    const { response } = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(id)
      .public(isPublic)
      .numberOfChunks(numberOfChunks)
      .progressHook(progressHook, loadedSize, resourceSize)
      .cancelHook(cancelHook)
      .asArrayBuffer()
      .downloadFile();

    let fileData: any;
    if (response.headers['x-amz-meta-encryptedkey']) {
      fileData = response.data;
    } else {
      fileData = Buffer.from(response.data).toJSON();
    }
    return { fileData: fileData, headers: response.headers };
  };

  public async getProfile(wallet: any): Promise<any> {
    const publicSigningKey = await wallet.signingPublicKey();
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(publicSigningKey)
      .getProfile();
  };


  public async updateProfile(wallet: Wallet, name: string, avatarUri: string): Promise<void> {
    const address = await wallet.getAddress();
    await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(address)
      .data({
        name: name,
        avatarUri: avatarUri
      })
      .updateProfile();
  };

  public async deleteVault(vaultId: string): Promise<void> {
    await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(vaultId)
      .deleteVault();
  }

  public async inviteNewUser(vaultId: string, email: string, role: string): Promise<{ id: string }> {
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(vaultId)
      .data({
        email: email,
        role: role
      })
      .invite();
  }


  public async inviteResend(vaultId: string, membershipId: string): Promise<{ id: string }> {
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(vaultId)
      .data({
        membershipId: membershipId,
      })
      .invite();
  }

  public async getObject(id: string, type: objectType): Promise<any> {
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(id)
      .data({ type })
      .getObject();
  };

  public async getMembershipKeys(vaultId: string, wallet: Wallet): Promise<MembershipKeys> {
    const publicSigningKey = await wallet.signingPublicKey();
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .contractId(vaultId)
      .resourceId(publicSigningKey)
      .getMembershipKeys();
  };

  public async getNodeState(stateId: string): Promise<any> {
    const { response } = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(stateId)
      .downloadState()

    return response.data
  };

  public async getNode(id: string): Promise<any> {
    const response = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(id)
      .getNode()

    return response.data
  };

  public async getContractState(objectId: string): Promise<ContractState> {
    const contract = await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .contractId(objectId)
      .getContract();
    return contract.state;
  };

  public async getMemberships(wallet: Wallet): Promise<Array<Membership>> {
    const publicSigningKey = await wallet.signingPublicKey();
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(publicSigningKey)
      .getMemberships();
  };

  public async getVaults(wallet: Wallet): Promise<Array<any>> {
    const publicSigningKey = await wallet.signingPublicKey();
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .resourceId(publicSigningKey)
      .getVaults();
  };

  public async getObjectsByVaultId(vaultId: string, type: objectType, shouldListAll = false): Promise<Array<any>> {
    return await new ApiClient()
      .env(this.config)
      .auth(this.jwtToken)
      .contractId(vaultId)
      .data({
        type,
        shouldListAll
      })
      .getObjects();
  };

  public async getTransactions(vaultId: string): Promise<Array<any>> {
    throw new Error("Method not implemented");
  }
}

export {
  AkordApi
}
