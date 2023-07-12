import axios, { AxiosRequestConfig } from "axios";
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
import { StorageClass } from "../types/file";

export class ApiClient {
  private _storageurl: string;
  private _apiurl: string;
  private _filesDir: string = "files";
  private _contractUri: string = "contracts";
  private _transactionUri: string = "transactions";
  private _resourceId: string;
  private _isPublic: boolean;
  private _data: any;
  private _metadata: any;
  private _queryParams: any = {};
  private _responseType: string = "json";
  private _progressHook: (progress: any, data?: any) => void
  private _processed: number
  private _total: number
  private _cancelHook: AbortController
  private _tags: Tags;
  private _input: ContractInput;
  private _vaultId: string;
  private _cacheOnly: boolean;
  private _storage: StorageClass;
  private _numberOfChunks: number;

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
    this._cacheOnly = cacheOnly;
    this.queryParams({ cacheOnly: cacheOnly })
    return this;
  }

  storage(storage: StorageClass): ApiClient {
    this._storage = storage;
    return this;
  }

  asArrayBuffer(): ApiClient {
    this.setResponseType("arraybuffer");
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

  setResponseType(responseType: string): ApiClient {
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
   * 
   * @requires: 
   * - auth() 
   * @uses:
   * - data()
   */
  async contract() {
    const response = await this.post(`${this._apiurl}/vaults`);
    return response.id;
  }

  async getContract(): Promise<Contract> {
    return await this.public(true).get(`${this._storageurl}/${this._contractUri}/${this._vaultId}`);
  }

  async existsUser(): Promise<Boolean> {
    try {
      await this.get(`${this._apiurl}/users`);
    } catch (e) {
      if (!(e instanceof NotFound)) {
        throw e;
      }
      return false;
    }
    return true;
  }

  async getUser(): Promise<User> {
    return await this.get(`${this._apiurl}/users`);
  }

  async getUserPublicData(): Promise<UserPublicInfo> {
    return await this.get(`${this._apiurl}/users`);
  }

  async updateUser(): Promise<any> {
    return await this.fetch("put", `${this._apiurl}/users`);
  }

  async deleteVault(): Promise<void> {
    await this.delete(`${this._apiurl}/vaults/${this._vaultId}`);
  }

  async getMembers(): Promise<Array<Membership>> {
    return await this.get(`${this._apiurl}/vaults/${this._vaultId}/members`);
  }

  async getNotifications(): Promise<Paginated<any>> {
    return await this.get(`${this._apiurl}/notifications`);
  }

  async getMemberships(): Promise<Paginated<Membership>> {
    return await this.get(`${this._apiurl}/memberships`);
  }

  async getVaults(): Promise<Paginated<Vault>> {
    return await this.get(`${this._apiurl}/vaults`);
  }

  async getMembershipKeys(): Promise<MembershipKeys> {
    return await this.public(true).get(`${this._apiurl}/vaults/${this._vaultId}/keys`);
  }

  async getNodesByVaultId<T>(): Promise<Paginated<T>> {
    return await this.public(true).get(`${this._apiurl}/vaults/${this._vaultId}/nodes`);
  }

  async getMembershipsByVaultId(): Promise<Paginated<Membership>> {
    return await this.get(`${this._apiurl}/vaults/${this._vaultId}/memberships`);
  }

  async getNode<T>(): Promise<T> {
    return await this.public(true).get(`${this._apiurl}/nodes/${this._resourceId}`);
  }

  async getMembership(): Promise<Membership> {
    return await this.get(`${this._apiurl}/memberships/${this._resourceId}`);
  }

  async getVault(): Promise<Vault> {
    return await this.public(true).get(`${this._apiurl}/vaults/${this._resourceId}`);
  }

  async getTransactions(): Promise<Array<Transaction>> {
    return await this.get(`${this._apiurl}/vaults/${this._vaultId}/transactions`);
  }

  async patchNotifications(): Promise<Paginated<any>> {
    return await this.patch(`${this._apiurl}/notifications`);
  }

  async invite(): Promise<{ id: string }> {
    const response = await this.post(`${this._apiurl}/vaults/${this._vaultId}/members`);
    return response.id;
  }

  async inviteResend(): Promise<{ id: string }> {
    const response = await this.post(`${this._apiurl}/vaults/${this._vaultId}/members/${this._resourceId}`);
    return response.id;
  }

  async revokeInvite(): Promise<{ id: string }> {
    const response = await this.delete(`${this._apiurl}/vaults/${this._vaultId}/members/${this._resourceId}`);
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
   * - auth() 
   * - vaultId() 
   * - data()
   */
  async transaction<T>() {
    if (!this._input) {
      throw new BadRequest("Input is required to use /transactions endpoint");
    }
    if (!this._tags) {
      throw new BadRequest("Tags is required to use /transactions endpoint");
    }

    this.data({
      input: this._input,
      tags: this._tags,
      metadata: this._metadata
    });
    const response = await this.post(`${this._apiurl}/vaults/${this._vaultId}/transactions`);
    return response;
  }

  /**
   * Schedules transaction posting
   * @requires: 
   * - auth() 
   * - resourceId() 
   * @uses:
   * - tags()
   */
  async asyncTransaction() {
    if (!this._resourceId) {
      throw new BadRequest("Resource id is required to use /transactions/files endpoint");
    }

    this.data({
      resourceUrl: this._resourceId,
      tags: this._tags,
      async: true,
      numberOfChunks: this._numberOfChunks
    });
    await this.post(`${this._apiurl}/${this._transactionUri}/files`);
  }

  /**
   * 
   * @requires: 
   * - auth() 
   * - data()
   */
  async uploadState() {
    const response = await this.post(`${this._apiurl}/states`);
    return response.id;
  }

  /**
   * 
   * @requires: 
   * - auth() 
   * - data()
   * @uses:
   * - tags()
   * - resourceId()
   */
  async uploadFile(): Promise<string[]> {
    const auth = await Auth.getAuthorization();
    if (!auth) {
      throw new Unauthorized("Authentication is required to use Akord API");
    }
    if (!this._data) {
      throw new BadRequest('Missing data to upload. Use ApiClient#data() to add it')
    }

    const me = this;
    const config = {
      method: 'post',
      url: `${this._storageurl}/files`,
      data: this._data,
      headers: {
        'Authorization': auth,
        'x-amz-meta-tags': JSON.stringify(this._tags),
        'x-amz-meta-storage-class': this._storage,
        'Content-Type': 'application/octet-stream'
      },
      signal: this._cancelHook ? this._cancelHook.signal : null,
      onUploadProgress(progressEvent) {
        if (me._progressHook) {
          let progress;
          if (me._total) {
            progress = Math.round((me._processed + progressEvent.loaded) / me._total * 100);
          } else {
            progress = Math.round(progressEvent.loaded / progressEvent.total * 100);
          }
          me._progressHook(progress, { id: me._resourceId, total: progressEvent.total });
        }
      }
    } as AxiosRequestConfig;

    try {
      const response = await axios(config);
      return response.data.resourceUri;
    } catch (error) {
      throwError(error.response?.status, error.response?.data?.msg, error);
    }
  }

  /**
  * 
  * @requires: 
  * - auth() 
  * - resourceId()
  */
  async downloadState() {
    return await this.get(`${this._apiurl}/states/${this._resourceId}`);
  }

  /**
  * 
  * @requires: 
  * - auth() 
  * - resourceId()
  */
  async downloadFile() {
    const auth = await Auth.getAuthorization();
    if (!auth && !this._isPublic) {
      throw new Unauthorized("Authentication is required to use Akord API");
    }
    if (!this._resourceId) {
      throw new BadRequest('Missing resource id to download')
    }

    const me = this;
    const config = {
      method: 'get',
      url: `${this._storageurl}/${this._filesDir}/${this._resourceId}`,
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
