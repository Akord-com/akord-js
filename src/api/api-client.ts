import axios, { AxiosRequestConfig } from "axios";
import { fetch } from 'fetch-undici';
import { Contract, ContractInput, Tags } from "../types/contract";
import { Membership, MembershipKeys } from "../types/membership";
import { Transaction } from "../types/transaction";
import { nextToken, isPaginated, Paginated } from "../types/paginated";
import { Vault } from "../types/vault";
import { Auth } from "@akord/akord-auth";
import { Unauthorized } from "../errors/unauthorized";
import { throwError } from "../errors/error";
import { BadRequest } from "../errors/bad-request";
import { NotFound } from "../errors/not-found";
import { User, UserPublicInfo } from "../types/user";
import { StorageType } from "../types/file";

export class ApiClient {
  private _storageurl: string;
  private _apiurl: string;

  // API endpoints
  private _fileUri: string = "files";
  private _contractUri: string = "contracts";
  private _transactionUri: string = "transactions";
  private _vaultUri: string = "vaults";
  private _nodeUri: string = "nodes";
  private _membershipUri: string = "memberships";
  private _userUri: string = "users";
  private _notificationUri: string = "notifications";

  // path params
  private _resourceId: string;
  private _vaultId: string;

  // request body
  private _tags: Tags;
  private _state: any; // vault/node/membership json state
  private _input: ContractInput;
  private _metadata: any;
  private _numberOfChunks: number;

  // axios config
  private _data: AxiosRequestConfig["data"];
  private _queryParams: any = {};
  private _responseType: string = "json";
  private _progressHook: (progress: any, data?: any) => void
  private _cancelHook: AbortController

  // auxiliar
  private _isPublic: boolean;
  private _processed: number
  private _total: number
  private _storage: StorageType;

  constructor() { }

  env(config: { apiurl: string, storageurl: string }): ApiClient {
    this._apiurl = config.apiurl;
    this._storageurl = config.storageurl;
    return this;
  }

  resourceId(resourceId: string): ApiClient {
    this._resourceId = resourceId;
    return this;
  }

  public(isPublic: boolean): ApiClient {
    this._isPublic = isPublic;
    return this;
  }

  cacheOnly(cacheOnly: boolean): ApiClient {
    this.queryParams({ cacheOnly: cacheOnly })
    return this;
  }

  storage(storage: StorageType): ApiClient {
    this._storage = storage;
    return this;
  }

  vaultId(vaultId: string): ApiClient {
    this._vaultId = vaultId;
    return this;
  }

  data(data: any): ApiClient {
    this._data = data;
    return this;
  }

  metadata(metadata: any): ApiClient {
    this._metadata = metadata;
    if (metadata?.cacheOnly) {
      this.cacheOnly(metadata.cacheOnly)
    }
    return this;
  }

  state(state: any): ApiClient {
    this._state = state;
    return this;
  }

  queryParams(queryParams: any): ApiClient {
    if (queryParams) {
      this._queryParams = { ...this._queryParams, ...queryParams };
    } else {
      this._queryParams = {}
    }
    return this;
  }

  tags(tags: Tags): ApiClient {
    this._tags = tags;
    return this;
  }

  responseType(responseType: string): ApiClient {
    this._responseType = responseType;
    return this;
  }

  progressHook(hook: (progress: any, data?: any) => void, processed?: number, total?: number): ApiClient {
    this._progressHook = hook;
    this._processed = processed;
    this._total = total;
    return this;
  }

  cancelHook(hook: AbortController): ApiClient {
    this._cancelHook = hook;
    return this;
  }

  input(input: ContractInput): ApiClient {
    this._input = input;
    return this;
  }

  numberOfChunks(numberOfChunks: number): ApiClient {
    this._numberOfChunks = numberOfChunks;
    return this;
  }

  /**
   * Initialize a vault smart contract
   * @uses:
   * - tags()
   * - state()
   * @returns {Promise<string>}
   */
  async contract(): Promise<string> {
    this.data({ tags: this._tags, state: this._state })
    const response = await this.post(`${this._apiurl}/${this._vaultUri}`);
    return response.id;
  }

  /**
   * Get current vault contract state
   * @requires:
   * - vaultId()
   * @returns {Promise<Contract>}
   */
  async getContract(): Promise<Contract> {
    if (!this._vaultId) {
      throw new BadRequest("Missing vault id to get contract state. Use ApiClient#vaultId() to add it");
    }
    return await this.public(true).get(`${this._storageurl}/${this._contractUri}/${this._vaultId}`);
  }

  /**
   *
   * @uses:
   * - queryParams() - email
   * @returns {Promise<Boolean>}
   */
  async existsUser(): Promise<Boolean> {
    try {
      await this.get(`${this._apiurl}/${this._userUri}`);
    } catch (e) {
      if (!(e instanceof NotFound)) {
        throw e;
      }
      return false;
    }
    return true;
  }

  /**
   * Fetch currently authenticated user
   * @returns {Promise<User>}
   */
  async getUser(): Promise<User> {
    return await this.get(`${this._apiurl}/${this._userUri}`);
  }

  /**
   *
   * @uses:
   * - queryParams() - email
   * @returns {Promise<UserPublicInfo>}
   */
  async getUserPublicData(): Promise<UserPublicInfo> {
    return await this.get(`${this._apiurl}/${this._userUri}`);
  }

  /**
   *
   * @uses:
   * - data()
   */
  async updateUser(): Promise<any> {
    return await this.fetch("put", `${this._apiurl}/${this._userUri}`);
  }

  /**
   *
   * @uses:
   * - vaultId()
   */
  async deleteVault(): Promise<void> {
    await this.delete(`${this._apiurl}/${this._vaultUri}/${this._vaultId}`);
  }

  /**
   *
   * @uses:
   * - vaultId()
   * @returns {Promise<Array<Membership>>}
   */
  async getMembers(): Promise<Array<Membership>> {
    return await this.get(`${this._apiurl}/${this._vaultUri}/${this._vaultId}/members`);
  }

  /**
   * Get notifications for currently authenticated user
   */
  async getNotifications(): Promise<Paginated<any>> {
    return await this.get(`${this._apiurl}/${this._notificationUri}`);
  }

  /**
   * Get memberships for currently authenticated user
   * @uses:
   * - queryParams() - limit, nextToken
   * @returns {Promise<Paginated<Membership>>}
   */
  async getMemberships(): Promise<Paginated<Membership>> {
    return await this.get(`${this._apiurl}/${this._membershipUri}`);
  }

  /**
   * Get vaults for currently authenticated user
   * @uses:
   * - queryParams() - limit, nextToken, tags, filter
   * @returns {Promise<Paginated<Vault>>}
   */
  async getVaults(): Promise<Paginated<Vault>> {
    return await this.get(`${this._apiurl}/${this._vaultUri}`);
  }

  /**
   * Get user membership keys for given vault
   * @uses:
   * - vaultId()
   * @returns {Promise<MembershipKeys>}
   */
  async getMembershipKeys(): Promise<MembershipKeys> {
    return await this.public(true).get(`${this._apiurl}/${this._vaultUri}/${this._vaultId}/keys`);
  }

  /**
   * Get nodes by vault id and type
   * @uses:
   * - vaultId()
   * - queryParams() - type, parentId, limit, nextToken, tags, filter
   * @returns {Promise<Paginated<T>>}
   */
  async getNodesByVaultId<T>(): Promise<Paginated<T>> {
    return await this.public(true).get(`${this._apiurl}/${this._vaultUri}/${this._vaultId}/${this._nodeUri}`);
  }

  /**
   * Get memberships by vault id
   * @uses:
   * - vaultId()
   * - queryParams() - limit, nextToken, filter
   * @returns {Promise<Paginated<Membership>>}
   */
  async getMembershipsByVaultId(): Promise<Paginated<Membership>> {
    return await this.get(`${this._apiurl}/${this._vaultUri}/${this._vaultId}/${this._membershipUri}`);
  }

  /**
   * Get node by id and type
   * @uses:
   * - resourceId()
   * - queryParams() - type
   * @returns {Promise<T>}
   */
  async getNode<T>(): Promise<T> {
    return await this.public(true).get(`${this._apiurl}/${this._nodeUri}/${this._resourceId}`);
  }

  /**
   * Get membership by id
   * @uses:
   * - resourceId()
   * @returns {Promise<Membership>}
   */
  async getMembership(): Promise<Membership> {
    return await this.get(`${this._apiurl}/${this._membershipUri}/${this._resourceId}`);
  }

  /**
   * Get vault by id
   * @uses:
   * - resourceId()
   * - queryParams() - withNodes, withMemberships, withMemos, withStacks, withFolders
   * @returns {Promise<Vault>}
   */
  async getVault(): Promise<Vault> {
    return await this.public(true).get(`${this._apiurl}/${this._vaultUri}/${this._resourceId}`);
  }

  /**
   * Get transactions by vault id
   * @uses:
   * - vaultId()
   * @returns {Promise<Array<Transaction>>}
   */
  async getTransactions(): Promise<Array<Transaction>> {
    return await this.get(`${this._apiurl}/${this._vaultUri}/${this._vaultId}/${this._transactionUri}`);
  }

  async patchNotifications(): Promise<Paginated<any>> {
    return await this.patch(`${this._apiurl}/${this._notificationUri}`);
  }

  async invite(): Promise<{ id: string }> {
    const response = await this.post(`${this._apiurl}/${this._vaultUri}/${this._vaultId}/members`);
    return response.id;
  }

  async inviteResend(): Promise<{ id: string }> {
    const response = await this.post(`${this._apiurl}/${this._vaultUri}/${this._vaultId}/members/${this._resourceId}`);
    return response.id;
  }

  async revokeInvite(): Promise<{ id: string }> {
    const response = await this.delete(`${this._apiurl}/${this._vaultUri}/${this._vaultId}/members/${this._resourceId}`);
    return response.id;
  }

  async post(url: string): Promise<any> {
    return this.fetch("post", url);
  }

  async patch(url: string): Promise<any> {
    return this.fetch("patch", url);
  }

  async get(url: string): Promise<any> {
    return this.fetch("get", url);
  }

  async delete(url: string): Promise<any> {
    return this.fetch("delete", url);
  }

  async fetch(method: string, url: string): Promise<any> {
    const auth = await Auth.getAuthorization()
    if (!auth && !this._isPublic) {
      throw new Unauthorized("Authentication is required to use Akord API");
    }

    const config = {
      method,
      url: this._queryParams ? this.addQueryParams(url, this._queryParams) : url,
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json'
      }
    } as AxiosRequestConfig;
    if (this._data) {
      config.data = this._data;
    }
    if (this._tags) {
      config.headers['x-amz-meta-tags'] = JSON.stringify(this._tags);
    }
    try {
      const response = await axios(config);
      if (isPaginated(response)) {
        return { items: response.data, nextToken: nextToken(response) }
      }
      return response.data;
    } catch (error) {
      throwError(error.response?.status, error.response?.data?.msg, error);
    }
  }

  addQueryParams = function (url: string, params: any) {
    const queryParams = new URLSearchParams(JSON.parse(JSON.stringify(params)));
    url += "?" + queryParams.toString();
    return url;
  }

  /**
   *
   * @requires:
   * - vaultId()
   * - input()
   * - tags()
   * @uses:
   * - metadata()
   * @returns {Promise<{ id: string, object: T }>}
   */
  async transaction<T>(): Promise<{ id: string; object: T; }> {
    if (!this._vaultId) {
      throw new BadRequest("Missing vault id to post transaction. Use ApiClient#vaultId() to add it");
    }
    if (!this._input) {
      throw new BadRequest("Missing input to post transaction. Use ApiClient#input() to add it");
    }
    if (!this._tags) {
      throw new BadRequest("Missing tags to post transaction. Use ApiClient#tags() to add it");
    }

    this.data({
      input: this._input,
      tags: this._tags,
      metadata: this._metadata
    });
    const { id, object } = await this.post(`${this._apiurl}/${this._vaultUri}/${this._vaultId}/${this._transactionUri}`);
    return { id, object };
  }

  /**
   * Schedules transaction posting
   * @requires:
   * - resourceId()
   * @uses:
   * - tags()
   * - public()
   * - numberOfChunks()
   */
  async asyncTransaction() {
    if (!this._resourceId) {
      throw new BadRequest("Missing resource id to schedule transaction posting. Use ApiClient#resourceId() to add it");
    }

    this.data({
      resourceUrl: this._resourceId,
      tags: this._tags,
      async: true,
      numberOfChunks: this._numberOfChunks
    });
    await this.post(`${this._apiurl}/${this._transactionUri}/${this._fileUri}`);
  }

  /**
   *
   * @requires:
   * - state()
   * @uses:
   * - tags()
   * - cacheOnly()
   * @returns {Promise<string>}
   */
  async uploadState(): Promise<string> {
    if (!this._state) {
      throw new BadRequest("Missing state to upload. Use ApiClient#state() to add it");
    }

    this.data({ data: this._state, tags: this._tags })
    const response = await this.post(`${this._apiurl}/states`);
    return response.id;
  }

  /**
   *
   * @requires:
   * - data()
   * @uses:
   * - resourceId()
   * - tags()
   * - storage()
   * - public()
   * - progressHook()
   * - cancelHook()
   * @returns {Promise<string[]>}
   */
  // async uploadFile(): Promise<string[]> {
  //   const auth = await Auth.getAuthorization();
  //   if (!auth) {
  //     throw new Unauthorized("Authentication is required to use Akord API");
  //   }
  //   if (!this._data) {
  //     throw new BadRequest("Missing data to upload. Use ApiClient#data() to add it");
  //   }

  //   const me = this;
  //   const config = {
  //     method: 'post',
  //     url: `${this._storageurl}/${this._fileUri}`,
  //     data: this._data,
  //     headers: {
  //       'Authorization': auth,
  //       'x-amz-meta-tags': JSON.stringify(this._tags),
  //       'x-amz-meta-storage-class': this._storage,
  //       'Content-Type': 'application/octet-stream'
  //     },
  //     signal: this._cancelHook ? this._cancelHook.signal : null,
  //     onUploadProgress(progressEvent) {
  //       if (me._progressHook) {
  //         let progress;
  //         if (me._total) {
  //           progress = Math.round((me._processed + progressEvent.loaded) / me._total * 100);
  //         } else {
  //           progress = Math.round(progressEvent.loaded / progressEvent.total * 100);
  //         }
  //         me._progressHook(progress, { id: me._resourceId, total: progressEvent.total });
  //       }
  //     }
  //   } as AxiosRequestConfig;

  //   try {
  //     const response = await axios(config);
  //     return response.data.resourceUri;
  //   } catch (error) {
  //     throwError(error.response?.status, error.response?.data?.msg, error);
  //   }
  // }

  async uploadFile(): Promise<string[]> {
    const auth = await Auth.getAuthorization();
    if (!auth) {
      throw new Unauthorized("Authentication is required to use Akord API");
    }
    if (!this._data) {
      throw new BadRequest("Missing data to upload. Use ApiClient#data() to add it");
    }

    try {
      const response = await fetch(`${this._storageurl}/${this._fileUri}`, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'x-amz-meta-tags': JSON.stringify(this._tags),
          'x-amz-meta-storage-class': this._storage,
          'Content-Type': 'application/octet-stream'
        },
        body: this._data,
        duplex: 'half',
        signal: this._cancelHook ? this._cancelHook.signal : null,
      });

      return (await response.json()).resourceUri;
    } catch (error) {
      throwError(error.response?.status, error.response?.data?.msg, error);
    }
  }

  /**
   *
   * @requires:
   * - resourceId()
   */
  async downloadState() {
    if (!this._resourceId) {
      throw new BadRequest("Missing resource id to download. Use ApiClient#resourceId() to add it");
    }
    return await this.get(`${this._apiurl}/states/${this._resourceId}`);
  }

  /**
   *
   * @requires:
   * - resourceId()
   * @uses:
   * - responseType()
   * - public()
   * - progressHook()
   * - cancelHook()
   * - numberOfChunks()
   */
  async downloadFile() {
    const auth = await Auth.getAuthorization();
    if (!auth && !this._isPublic) {
      throw new Unauthorized("Authentication is required to use Akord API");
    }
    if (!this._resourceId) {
      throw new BadRequest("Missing resource id to download. Use ApiClient#resourceId() to add it");
    }

    const me = this;
    const config = {
      method: 'get',
      url: `${this._storageurl}/${this._resourceId}`,
      responseType: this._responseType,
      signal: this._cancelHook ? this._cancelHook.signal : null,
      onDownloadProgress(progressEvent) {
        if (me._progressHook) {
          let progress;
          if (me._total) {
            const chunkSize = me._total / me._numberOfChunks;
            progress = Math.round(me._processed / me._total * 100 + progressEvent.loaded / progressEvent.total * chunkSize / me._total * 100);
          } else {
            progress = Math.round(progressEvent.loaded / progressEvent.total * 100);
          }
          me._progressHook(progress, { id: me._resourceId, total: progressEvent.total });
        }
      },
    } as AxiosRequestConfig

    if (!this._isPublic) {
      config.headers = {
        'Authorization': auth,
      }
    }

    try {
      const response = await axios(config);
      return { resourceUrl: this._resourceId, response: response };
    } catch (error) {
      throwError(error.response?.status, error.response?.data?.msg, error);
    }
  }
}
