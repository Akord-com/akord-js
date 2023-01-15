import { jsonToBase64 } from "@akord/crypto";
import axios, { AxiosRequestConfig } from "axios";
import { v4 as uuid } from "uuid";
import { Contract, ContractInput, Tags } from "../types/contract";

export class PermapostExecutor {
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
    private _dataRefs: string;
    private _responseType: string = "json";
    private _progressHook: (progress: any, data?: any) => void
    private _processed: number
    private _total: number
    private _cancelHook: AbortController
    private _tags: Tags;
    private _input: ContractInput;
    private _contractId: string;
    private _metadata: string;
    private _shouldBundleTransaction: boolean;
    private _numberOfChunks: number;

    constructor() { }

    env(config: { apiurl: string, storageurl: string }): PermapostExecutor {
        this._apiurl = config.apiurl;
        this._storageurl = config.storageurl;
        return this;
    }

    auth(jwt: string): PermapostExecutor {
        this._jwt = jwt;
        return this;
    }

    resourceId(resourceId: string): PermapostExecutor {
        this._resourceId = resourceId;
        return this;
    }

    public(isPublic: boolean): PermapostExecutor {
        this._isPublic = isPublic;
        return this;
    }

    bundle(shouldBundleTransaction: boolean): PermapostExecutor {
        this._shouldBundleTransaction = shouldBundleTransaction;
        return this;
    }

    asArrayBuffer(): PermapostExecutor {
        this.setResponseType("arraybuffer");
        return this;
    }

    contractId(contractId: string): PermapostExecutor {
        this._contractId = contractId;
        return this;
    }

    data(data: any): PermapostExecutor {
        this._data = data;
        return this;
    }

    tags(tags: Tags): PermapostExecutor {
        this._tags = tags;
        return this;
    }

    metadata(metadata: any): PermapostExecutor {
        this._metadata = metadata
        if (metadata && metadata.dataRefs) {
            this._dataRefs = typeof metadata.dataRefs === 'string' ? metadata.dataRefs : JSON.stringify(metadata.dataRefs);
        }
        return this;
    }

    setResponseType(responseType: string): PermapostExecutor {
        this._responseType = responseType;
        return this;
    }

    progressHook(hook: (progress: any, data?: any) => void, processed?: number, total?: number): PermapostExecutor {
        this._progressHook = hook;
        this._processed = processed;
        this._total = total;
        return this;
    }

    cancelHook(hook: AbortController): PermapostExecutor {
        this._cancelHook = hook;
        return this;
    }

    input(input: ContractInput): PermapostExecutor {
        this._input = input;
        return this;
    }

    numberOfChunks(numberOfChunks: number): PermapostExecutor {
        this._numberOfChunks = numberOfChunks;
        return this;
    }

    /**
     * 
     * @requires: 
     * - auth() 
     * @uses:
     * - tags()
     * - data()
     */
    async contract() {
        if (!this._jwt) {
            throw Error('Authentication is required to use permapost')
        }

        const config = {
            method: 'post',
            url: `${this._apiurl}/${this._contractUri}`,
            data: { tags: this._tags, state: this._data },
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json',
                'Referer': 'v2.akord.com'
            }
        } as AxiosRequestConfig
        const response = await axios(config);
        return response.data.contractTxId
    }

    async getContract(): Promise<Contract> {
        const config = {
            method: 'get',
            url: `${this._storageurl}/${this._contractUri}/${this._contractId}`,
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        const response = await axios(config);
        return response.data
    }

    async getNode(): Promise<any> {
        const config = {
            method: 'get',
            url: `${this._apiurl}/nodes/${this._resourceId}`,
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        const response = await axios(config);
        return response
    }

    async updateProfile(): Promise<any> {
        const config = {
            method: 'put',
            url: `${this._apiurl}/profiles/${jsonToBase64({address: this._resourceId})}`, //ApiG bug with double encoding
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            },
            data: this._data,
        } as AxiosRequestConfig
        const response = await axios(config);
        return response
    }

    async deleteVault(): Promise<void> {
        const config = {
            method: 'delete',
            url: `${this._apiurl}/vaults/${this._resourceId}`,
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        await axios(config);
    }

    async invite(): Promise<{ id: string }> {
        const config = {
            method: 'post',
            url: `${this._apiurl}/vaults/${this._resourceId}/invites`,
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            },
            data: this._data
        } as AxiosRequestConfig
        const response = await axios(config);
        return response.data.id
    }

    async inviteResend(): Promise<{ id: string }> {
        const config = {
            method: 'post',
            url: `${this._apiurl}/vaults/${this._resourceId}/invites/${this._data.membershipId}`,
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        const response = await axios(config);
        return response.data.id
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
        if (!this._jwt) {
            throw Error('Authentication is required to use permapost')
        }
        if (!this._input) {
            throw Error('Input is required to use permapost')
        }
        if (!this._metadata) {
            throw Error('Metadata is required to use permapost')
        }


        const config = {
            method: 'post',
            url: `${this._apiurl}/${this._transactionUri}`,
            data: { contractId: this._contractId, input: this._input, metadata: this._metadata, tags: this._tags, state: this._data },
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        const response = await axios(config);
        return response.data.txId
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
        if (!this._jwt) {
            throw Error('Authentication is required to use permapost')
        }
        if (!this._resourceId) {
            throw Error('Reource id is required to use permapost')
        }

        const tags = this._tags.filter((tag) =>
            tag.name !== "Public-Key"
        )

        const config = {
            method: 'post',
            url: `${this._apiurl}/${this._transactionUri}/files`,
            data: { resourceUrl: this._resourceId, tags: tags, async: true, numberOfChunks: this._numberOfChunks },
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        await axios(config);
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
        if (!this._jwt) {
            throw Error('Authentication is required to use permapost')
        }
        if (!this._resourceId) {
            this._resourceId = uuid();
        }

        const tags = this._tags?.filter((tag) =>
            tag.name !== "Public-Key"
        )

        const data = { resourceUrl: this._resourceId, tags: tags };

        const config = {
            method: 'post',
            url: `${this._apiurl}/${this._transactionUri}/files`,
            data: data,
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        const response = await axios(config);
        return response.data.txId
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
        if (!this._jwt) {
            throw Error('Authentication is required to use permapost')
        }

        const tags = this._tags.filter((tag) =>
            tag.name !== "Public-Key"
        )

        const data = { resourceUrl: this._resourceId, tags: tags, data: this._data };

        const config = {
            method: 'post',
            url: `${this._apiurl}/${this._transactionUri}/states`,
            data: data,
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        const response = await axios(config);
        return response.data.txId
    }

    private async upload() {
        if (!this._jwt) {
            throw Error('Authentication is required to use permapost')
        }
        if (!this._data) {
            throw Error('Missing data to upload. Use Permapost#data() to add it')
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
            throw Error('Authentication is required to use permapost')
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
