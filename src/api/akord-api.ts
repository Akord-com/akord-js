import { ClientConfig } from "../config";
import { Api } from "./api";
import { apiConfig, ApiConfig } from "./config";
import { ApiClient } from "./api-client";
import { Logger } from "../logger";
import { Membership, MembershipKeys, RoleType } from "../types/membership";
import { ContractInput, ContractState, Tags } from "../types/contract";
import { NodeType } from "../types/node";
import { Vault } from "../types/vault";
import { Transaction } from "../types/transaction";
import { Paginated } from "../types/paginated";

export default class AkordApi extends Api {

  public config!: ApiConfig;

  constructor(config: ClientConfig) {
    super();
    this.config = apiConfig(config.env);
  }

  public async uploadData(items: { data: any, tags: Tags }[], shouldBundleTransaction?: boolean)
    : Promise<Array<string>> {
    const resources = [];

    await Promise.all(items.map(async (item, index) => {
      const resource = await new ApiClient()
        .env(this.config)
        .data({ data: item.data, tags: item.tags })
        .bundle(shouldBundleTransaction)
        .uploadState()
      Logger.log("Uploaded state with id: " + resource);
      resources[index] = resource;
    }));
    return resources;
  };

  public async postContractTransaction<T>(contractId: string, input: ContractInput, tags: Tags): Promise<{ id: string, object: T }> {
    const { id, object } = await new ApiClient()
      .env(this.config)
      .vaultId(contractId)
      .input(input)
      .tags(tags)
      .transaction<T>()
    Logger.log("Uploaded contract interaction with id: " + id);
    return { id, object };
  };

  public async getMembers(vaultId: string): Promise<Array<Membership>> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .getMembers();
  };

  public async initContractId(tags: Tags, state?: any): Promise<string> {
    const contractId = await new ApiClient()
      .env(this.config)
      .data({ tags, state })
      .contract()
    Logger.log("Created contract with id: " + contractId);
    return contractId;
  };

  public async getUserFromEmail(email: string): Promise<any> {
    return await new ApiClient()
      .env(this.config)
      .resourceId(email)
      .getUser();
  };

  public async uploadFile(file: any, tags: Tags, isPublic?: boolean, shouldBundleTransaction?: boolean, progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController): Promise<{ resourceUrl: string, resourceTx: string }> {
    const resource = await new ApiClient()
      .env(this.config)
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

  public async getProfile(): Promise<any> {
    return await new ApiClient()
      .env(this.config)
      .getProfile();
  };


  public async updateProfile(name: string, avatarUri: string): Promise<void> {
    await new ApiClient()
      .env(this.config)
      .data({
        name: name,
        avatarUri: avatarUri
      })
      .updateProfile();
  };

  public async deleteVault(vaultId: string): Promise<void> {
    await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .deleteVault();
  }

  public async inviteNewUser(vaultId: string, email: string, role: RoleType): Promise<{ id: string }> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .data({
        email: email,
        role: role
      })
      .invite();
  }


  public async inviteResend(vaultId: string, membershipId: string): Promise<{ id: string }> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .resourceId(membershipId)
      .inviteResend();
  }

  public async getNode<T>(id: string, type: NodeType): Promise<T> {
    return await new ApiClient()
      .env(this.config)
      .resourceId(id)
      .queryParams({ type })
      .getNode();
  };

  public async getMembership(id: string): Promise<Membership> {
    return await new ApiClient()
      .env(this.config)
      .resourceId(id)
      .getMembership();
  };

  public async getVault(id: string): Promise<Vault> {
    return await new ApiClient()
      .env(this.config)
      .resourceId(id)
      .getVault();
  };

  public async getMembershipKeys(vaultId: string): Promise<MembershipKeys> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .getMembershipKeys();
  };

  public async getNodeState(stateId: string): Promise<any> {
    const { response } = await new ApiClient()
      .env(this.config)
      .resourceId(stateId)
      .downloadState()

    return response.data
  };

  public async getNotifications(): Promise<Paginated<any>> {
    return await new ApiClient()
      .env(this.config)
      .getNotifications()
  };

  public async readNotifications(options: {
    id?: string,
    vaultId?: string,
    readOnly?: Boolean,
    shouldDelete?: Boolean
  }): Promise<void> {
    await new ApiClient()
      .env(this.config)
      .queryParams(options)
      .patchNotifications()
  };

  public async getContractState(objectId: string): Promise<ContractState> {
    const contract = await new ApiClient()
      .env(this.config)
      .vaultId(objectId)
      .getContract();
    return contract.state;
  };

  public async getMemberships(limit?: number, nextToken?: string): Promise<Paginated<Membership>> {
    return await new ApiClient()
      .env(this.config)
      .queryParams({
        limit,
        nextToken
      })
      .getMemberships();
  };

  public async getVaults(filter = {}, limit?: number, nextToken?: string): Promise<Paginated<Vault>> {
    return await new ApiClient()
      .env(this.config)
      .queryParams({
        filter: JSON.stringify(filter),
        limit,
        nextToken
      })
      .getVaults();
  };

  public async getNodesByVaultId<T>(vaultId: string, type: NodeType, parentId?: string, filter = {}, limit?: number, nextToken?: string): Promise<Paginated<T>> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .queryParams({
        type,
        parentId,
        filter: JSON.stringify(filter),
        limit,
        nextToken
      })
      .getNodesByVaultId();
  };

  public async getMembershipsByVaultId(vaultId: string, filter = {}, limit?: number, nextToken?: string): Promise<Paginated<Membership>> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .queryParams({
        filter: JSON.stringify(filter),
        limit,
        nextToken
      })
      .getMembershipsByVaultId();
  };

  public async getTransactions(vaultId: string): Promise<Array<Transaction>> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .getTransactions();
  }
}

export {
  AkordApi
}
