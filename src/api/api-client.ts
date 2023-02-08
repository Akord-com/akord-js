import axios, { AxiosRequestConfig } from "axios";
import { v4 as uuid } from "uuid";
import { Contract, ContractInput, Tags } from "../types/contract";
import { Membership, MembershipKeys } from "../types/membership";
import { Paginated } from "../types/paginated";
import { Vault } from "../types/vault";

export class ApiClient {
  private _jwt: string;
  private _storageurl: string;
  private _apiurl: string;
  private _dir: string = "files";
  private _filesDir: string = "files";
  private _publicDataDir: string = "public";
  private _contractUri: string = "contracts";
  private _transactionUri: string = "transactions";
  private _stateDir: string = "states";
  private _resourceId: string;
  private _isPublic: boolean;
  private _data: any;
  private _queryParams: any;
  private _dataRefs: string;
  private _responseType: string = "json";
  private _progressHook: (progress: any, data?: any) => void
  private _processed: number
  private _total: number
  private _cancelHook: AbortController
  private _tags: Tags;
  private _input: ContractInput;
  private _vaultId: string;
  private _metadata: string;
  private _shouldBundleTransaction: boolean;
  private _numberOfChunks: number;

  constructor() { }

  env(config: { apiurl: string, storageurl: string }): ApiClient {
    this._apiurl = config.apiurl;
    this._storageurl = config.storageurl;
    return this;
  }

  auth(jwt: string): ApiClient {
    this._jwt = jwt;
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

  bundle(shouldBundleTransaction: boolean): ApiClient {
    this._shouldBundleTransaction = shouldBundleTransaction;
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

  queryParams(queryParams: any): ApiClient {
    this._queryParams = queryParams;
    return this;
  }

  tags(tags: Tags): ApiClient {
    this._tags = tags;
    return this;
  }

  metadata(metadata: any): ApiClient {
    this._metadata = metadata
    if (metadata && metadata.dataRefs) {
      this._dataRefs = typeof metadata.dataRefs === 'string' ? metadata.dataRefs : JSON.stringify(metadata.dataRefs);
    }
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
    const response = await this.post(`${this._apiurl}/${this._contractUri}`);
    return response.contractTxId;
  }

  async getContract(): Promise<Contract> {
    return await this.public(true).get(`${this._storageurl}/${this._contractUri}/${this._vaultId}`);
  }

  async getNode(): Promise<any> {
    return await this.public(true).get(`${this._apiurl}/nodes/${this._resourceId}`);
  }

  async getNodes(): Promise<any> {
    return await this.get(`${this._apiurl}/nodes/${this._resourceId}`);
  }

  async updateProfile(): Promise<any> {
    return await this.fetch("put", `${this._apiurl}/profiles`);
  }

  async deleteVault(): Promise<void> {
    await this.fetch("delete", `${this._apiurl}/vaults/${this._vaultId}`);
  }

  async getUser(): Promise<any> {
    return await this.get(`${this._apiurl}/users/${this._resourceId}`);
  }

  async getProfile(): Promise<any> {
    return await this.get(`${this._apiurl}/profiles`);
  }

  async getMembers(): Promise<Array<Membership>> {
    return await this.get(`${this._apiurl}/vaults/${this._vaultId}/members`);
  }

  async getNotifications(): Promise<Paginated<any>> {
    return await this.get(`${this._apiurl}/notifications`);
  }

  async getMemberships(): Promise<Array<Membership>> {
    return await this.get(`${this._apiurl}/memberships`);
  }

  async getVaults(): Promise<Array<Vault>> {
    return await this.get(`${this._apiurl}/vaults`);
  }

  async getMembershipKeys(): Promise<MembershipKeys> {
    return await this.get(`${this._apiurl}/vaults/${this._vaultId}/keys`);
  }

  async getObjects<T>(): Promise<Array<T>> {
    return await this.get(`${this._apiurl}/vaults/${this._vaultId}/nodes`);
  }

  async getObject<T>(): Promise<T> {
    return await this.get(`${this._apiurl}/objects/${this._resourceId}`);
  }

  async invite(): Promise<{ id: string }> {
    const response = await this.post(`${this._apiurl}/vaults/${this._vaultId}/members`);
    return response.id;
  }

  async inviteResend(): Promise<{ id: string }> {
    const response = await this.post(`${this._apiurl}/vaults/${this._vaultId}/members/${this._resourceId}`);
    return response.id;
  }

  async post(url: string): Promise<any> {
    return this.fetch("post", url);
  }

  async get(url: string): Promise<any> {
    return this.fetch("get", url);
  }

  async fetch(method: string, url: string): Promise<any> {
    if (!this._jwt && !this._isPublic) {
      throw Error("Authentication is required to use Akord API");
    }

    const config = {
      method,
      url: this._queryParams ? this.addQueryParams(url, this._queryParams) : url,
      headers: {
        'Authorization': 'Bearer ' + this._jwt,
        'Content-Type': 'application/json'
      }
    } as AxiosRequestConfig;
    if (this._data) {
      config.data = this._data;
    }
    const response = await axios(config);
    return response.data;
  }

  addQueryParams = function (url: string, params: any) {
    Object.entries(params).forEach(([key, value], index) => {
      if (value) {
        let queryParam = index === 0 ? "?" : "&";
        queryParam += encodeURIComponent(key);
        queryParam += "=" + encodeURIComponent(value.toString());
        url += queryParam;
      }
    });
    return url;
  }

  /**
   * 
   * @requires: 
   * - auth() 
   * - contractId() 
   * - input() 
   * - metadata() 
   * @uses:
   * - tags()
   */
  async transaction() {
    if (!this._input) {
      throw Error("Input is required to use /transactions endpoint");
    }
    if (!this._metadata) {
      throw Error("Metadata is required to use /transactions endpoint");
    }

    this.data({
      contractId: this._vaultId,
      input: this._input,
      metadata: this._metadata,
      tags: this._tags,
      state: this._data
    });
    const response = await this.post(`${this._apiurl}/${this._transactionUri}`);
    return response.txId;
  }


  /**
   * Schedules transaction posting
   * @requires: 
   * - auth() 
   * - resourceId() 
   * - metadata() 
   * @uses:
   * - tags()
   */
  async asyncTransaction() {
    if (!this._resourceId) {
      throw Error("Resource id is required to use /transactions/files endpoint");
    }

    const tags = this._tags.filter((tag) =>
      tag.name !== "Public-Key"
    )

    this.data({
      resourceUrl: this._resourceId,
      tags: tags,
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
   * @uses:
   * - tags()
   * - dataRefs()
   * - resourceId()
   */
  async uploadState() {
    this._dir = this._stateDir;
    let resourceTx: string;
    if (this._shouldBundleTransaction) {
      resourceTx = await this.stateTransaction();
    }
    else {
      resourceTx = (await this.upload()).resourceTx;
    }
    return { resourceUrl: this._resourceId || resourceTx, id: resourceTx, resourceTx: resourceTx }
  }

  /**
   * 
   * @requires: 
   * - auth() 
   * - data()
   * @uses:
   * - tags()
   * - dataRefs()
   * - resourceId()
   */
  async uploadFile() {
    this._dir = this._filesDir;
    await this.upload();
    const resourceId = this._resourceId;
    const resourceTx = this._shouldBundleTransaction ? await this.fileTransaction() : null;
    return { resourceUrl: resourceId, id: resourceTx, resourceTx: resourceTx }
  }

  /**
   * 
   * @requires: 
   * - auth() 
   * - resourceId()
   */
  async downloadFile() {
    this._dir = this._filesDir;
    return await this.download();
  }

  /**
* 
* @requires: 
* - auth() 
* - resourceId()
*/
  async downloadState() {
    this._dir = this._stateDir;
    return await this.download();
  }

  /**
  * Creates data item from uploaded resource. Schedules bundled transaction
  * @requires: 
  * - auth() 
  * - resourceId() 
  * - metadata() 
  * @uses:
  * - tags()
  */
  private async fileTransaction() {
    if (!this._resourceId) {
      this._resourceId = uuid();
    }

    const tags = this._tags?.filter((tag) =>
      tag.name !== "Public-Key"
    )

    this.data({
      resourceUrl: this._resourceId,
      tags: tags
    });

    const response = await this.post(`${this._apiurl}/${this._transactionUri}/files`);
    return response.txId;
  }

  /**
  * Creates data item from uploaded resource. Schedules bundled transaction
  * @requires: 
  * - auth() 
  * - metadata() 
  * - data() 
  * @uses:
  * - tags()
  * - resourceId() 
  */
  private async stateTransaction() {
    const tags = this._tags.filter((tag) =>
      tag.name !== "Public-Key"
    )

    this.data({
      resourceUrl: this._resourceId,
      tags: tags,
      data: this._data
    });

    const response = await this.post(`${this._apiurl}/${this._transactionUri}/states`);
    return response.txId;
  }

  private async upload() {
    if (!this._jwt) {
      throw Error("Authentication is required to use Akord API");
    }
    if (!this._data) {
      throw Error('Missing data to upload. Use ApiClient#data() to add it')
    }
    if (!this._resourceId) {
      this._resourceId = this._isPublic ? this._publicDataDir + '/' + uuid() : uuid();
    }

    const me = this
    const config = {
      method: 'put',
      url: `${this._storageurl}/${this._dir}/${this._resourceId}`,
      data: this._data,
      headers: {
        'Authorization': 'Bearer ' + this._jwt,
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
    } as AxiosRequestConfig

    if (this._dataRefs) {
      config.headers['x-amz-meta-datarefs'] = this._dataRefs;
    }
    if (!this._shouldBundleTransaction) {
      config.headers['x-amz-meta-skipbundle'] = "true";
    }
    if (this._tags) {
      for (let tag of this._tags) {
        // TODO: move it into the API
        // ensure S3 backward compatibility
        if (tag.name === "Encrypted-Key") {
          config.headers['x-amz-meta-encryptedkey'] = tag.value;
        } else if (tag.name === "Initialization-Vector") {
          config.headers['x-amz-meta-iv'] = tag.value;
        } else if (tag.name === "Public-Key") {
          config.headers['x-amz-publickey'] = tag.value;
        } else {
          config.headers['x-amz-meta-' + tag.name.toLowerCase()] = tag.value;
        }
      }
      config.headers['x-amz-meta-tags'] = JSON.stringify(this._tags.filter((tag) =>
        tag.name !== "Public-Key"
      ));
    }

    const response = await axios(config);
    return { resourceUrl: this._resourceId, resourceTx: response.data.resourceTx }
  }

  private async download() {
    if (!this._jwt && !this._isPublic) {
      throw Error("Authentication is required to use Akord API");
    }
    if (!this._resourceId) {
      throw Error('Missing resource id to download')
    }

    const me = this;
    const config = {
      method: 'get',
      url: `${this._storageurl}/${this._dir}/${this._resourceId}`,
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
        'Authorization': 'Bearer ' + this._jwt,
      }
    }

    const response = await axios(config);
    const downloadResponse = { resourceUrl: this._resourceId, response: response }
    return downloadResponse
  }
}
