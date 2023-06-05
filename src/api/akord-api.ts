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
import { ListOptions, VaultApiGetOptions } from "../types/query-options";
import { User, UserPublicInfo } from "../types/user";
import { FileDownloadOptions, FileUploadOptions } from "../core/file";
import { EncryptionMetadata } from "../core";

export const defaultFileUploadOptions = {
  cacheOnly: false,
  public: false
};

export default class AkordApi extends Api {

  public config!: ApiConfig;

  constructor(config: ClientConfig) {
    super();
    this.config = apiConfig(config.env);
  }

  public async uploadData(items: { data: any, tags: Tags }[], options: FileUploadOptions = defaultFileUploadOptions)
    : Promise<Array<string>> {
    const resources = [];

    await Promise.all(items.map(async (item, index) => {
      const resource = await new ApiClient()
        .env(this.config)
        .data({ data: item.data, tags: item.tags })
        .cacheOnly(options.cacheOnly)
        .uploadState()
      Logger.log("Uploaded state with id: " + resource);
      resources[index] = resource;
    }));
    return resources;
  };

  public async postContractTransaction<T>(contractId: string, input: ContractInput, tags: Tags, metadata?: any): Promise<{ id: string, object: T }> {
    const { id, object } = await new ApiClient()
      .env(this.config)
      .vaultId(contractId)
      .metadata(metadata)
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

  public async uploadFile(file: ArrayBuffer, tags: Tags, options: FileUploadOptions = defaultFileUploadOptions): Promise<{ resourceUrl: string, resourceTx: string }> {
    const uploadOptions = {
      ...defaultFileUploadOptions,
      ...options
    }
    const resource = await new ApiClient()
      .env(this.config)
      .data(file)
      .tags(tags)
      .public(uploadOptions.public)
      .cacheOnly(uploadOptions.cacheOnly)
      .progressHook(uploadOptions.progressHook)
      .cancelHook(uploadOptions.cancelHook)
      .uploadFile()
    Logger.log("Uploaded file with id: " + resource.id);

    return resource;
  };

  public async downloadFile(id: string, options: FileDownloadOptions = {}): Promise<{ fileData: ArrayBuffer, metadata: EncryptionMetadata }> {
    const { response } = await new ApiClient()
      .env(this.config)
      .resourceId(id)
      .public(options.public)
      .numberOfChunks(options.numberOfChunks)
      .progressHook(options.progressHook, options.loadedSize, options.resourceSize)
      .cancelHook(options.cancelHook)
      .asArrayBuffer()
      .downloadFile();

    const fileData = response.data;
    const metadata = { encryptedKey: response.headers["x-amz-meta-encryptedkey"], iv: response.headers["x-amz-meta-iv"] };
    return { fileData, metadata };
  };

  public async existsUser(email: string): Promise<Boolean> {
    return await new ApiClient()
      .env(this.config)
      .queryParams({ email })
      .existsUser();
  }

  public async getUserPublicData(email: string): Promise<UserPublicInfo> {
    return await new ApiClient()
      .env(this.config)
      .queryParams({ email })
      .getUserPublicData();
  };

  public async getUser(): Promise<User> {
    return await new ApiClient()
      .env(this.config)
      .getUser();
  };


  public async updateUser(name: string, avatarUri: string[]): Promise<void> {
    await new ApiClient()
      .env(this.config)
      .data({
        name: name,
        avatarUri: avatarUri
      })
      .updateUser();
  };

  public async deleteVault(vaultId: string): Promise<void> {
    await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .deleteVault();
  }

  public async inviteNewUser(vaultId: string, email: string, role: RoleType, message?: string): Promise<{ id: string }> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .data({
        email: email,
        role: role
      })
      .metadata({ message })
      .invite();
  }

  public async revokeInvite(vaultId: string, membershipId: string): Promise<{ id: string }> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .resourceId(membershipId)
      .revokeInvite();
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

  public async getVault(id: string, options?: VaultApiGetOptions): Promise<Vault> {
    return await new ApiClient()
      .env(this.config)
      .resourceId(id)
      .queryParams({
        withNodes: options?.withNodes,
        withMemberships: options?.deep,
        withMemos: options?.deep,
        withStacks: options?.deep,
        withFolders: options?.deep,
      })
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

  public async getMemberships(options: ListOptions = {}): Promise<Paginated<Membership>> {
    return await new ApiClient()
      .env(this.config)
      .queryParams({
        limit: options.limit,
        nextToken: options.nextToken
      })
      .getMemberships();
  };

  public async getVaults(options: ListOptions = {}): Promise<Paginated<Vault>> {
    return await new ApiClient()
      .env(this.config)
      .queryParams({
        tags: JSON.stringify(options.tags ? options.tags : {}),
        filter: JSON.stringify(options.filter ? options.filter : {}),
        limit: options.limit,
        nextToken: options.nextToken
      })
      .getVaults();
  };

  public async getNodesByVaultId<T>(vaultId: string, type: NodeType, options: ListOptions = {}): Promise<Paginated<T>> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .queryParams({
        type,
        parentId: options.parentId,
        tags: JSON.stringify(options.tags ? options.tags : {}),
        filter: JSON.stringify(options.filter ? options.filter : {}),
        limit: options.limit,
        nextToken: options.nextToken
      })
      .getNodesByVaultId<T>();
  };

  public async getMembershipsByVaultId(vaultId: string, options: ListOptions = {}): Promise<Paginated<Membership>> {
    return await new ApiClient()
      .env(this.config)
      .vaultId(vaultId)
      .queryParams({
        filter: JSON.stringify(options.filter ? options.filter : {}),
        limit: options.limit,
        nextToken: options.nextToken
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
