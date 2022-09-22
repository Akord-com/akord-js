import axios, { AxiosRequestConfig } from "axios";
import { v4 as uuid } from "uuid";

export class PermapostExecutor {
    private _env: string = "dev";
    private _domain: string = "akord.link";
    private _jwt: string;
    private _url: string = `https://api.${this._env}.permapost-storage.${this._domain}`;
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
    private _progressHook: (progress: any) => void
    private _cancelHook: AbortController
    private _tags: Array<{ name: string, value: string }>;
    private _input: string;
    private _contractId: string;
    private _metadata: string;
    private _shouldBundleTransaction: boolean;

    constructor() { }

    env(env: string, domain: string): PermapostExecutor {
        this._env = env;
        this._domain = domain || this._domain;
        this._url = `https://api.${this._env}.permapost-storage.${this._domain}`;
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

    tags(tags: Array<any>): PermapostExecutor {
        if (tags) {
            this._tags = []
            for (let key in tags) {
                this._tags.push({
                    name: key.toString(),
                    value: tags[key].toString()
                })
            }
        }
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

    progressHook(hook: (progress: any) => void): PermapostExecutor {
        this._progressHook = hook;
        return this;
    }

    cancelHook(hook: AbortController): PermapostExecutor {
        this._cancelHook = hook;
        return this;
    }

    /**
     * 
     * this name must go away
     */
    input(input: string): PermapostExecutor {
        this._input = input;
        return this;
    }

    /**
     * 
     * @requires: 
     * - auth() 
     * @uses:
     * - tags()
     */
    async contract() {
        if (!this._jwt) {
            throw Error('Authentication is required to use permapost')
        }

        const config = {
            method: 'post',
            url: `${this._url}/${this._contractUri}`,
            data: { tags: this._tags },
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        const response = await axios(config);
        return response.data.contractTx
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
            url: `${this._url}/${this._transactionUri}`,
            data: { contractId: this._contractId, input: this._input, metadata: this._metadata, tags: this._tags },
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
     * - resourceId() 
     * - metadata() 
     * @uses:
     * - tags()
     */
    async bundleTransaction(type: string) {
        if (!this._jwt) {
            throw Error('Authentication is required to use permapost')
        }
        if (!this._resourceId) {
            throw Error('Reource id is required to use permapost')
        }

        const tags = this._tags.filter(function(tag) {
            return tag.name !== "Public-Key";
        })

        const config = {
            method: 'post',
            url: `${this._url}/${this._transactionUri}`,
            data: { resourceUrl: this._resourceId, tags: tags, type: type },
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/json'
            }
        } as AxiosRequestConfig
        const response = await axios(config);
        return response.data.resourceTx
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
        await this._upload();
        const resourceId = this._resourceId;
        const resourceTx = await this.bundleTransaction(this._stateDir);
        return { resourceUrl: resourceId, id: resourceTx, resourceTx: resourceTx }
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
        await this._upload();
        const resourceId = this._resourceId;
        const resourceTx = this._shouldBundleTransaction ? await this.bundleTransaction(this._filesDir) : null;
        return { resourceUrl: resourceId, id: resourceTx, resourceTx: resourceTx }

    }

    async _upload() {
        if (!this._jwt) {
            throw Error('Authentication is required to use permapost')
        }
        if (!this._data) {
            throw Error('Missing data to upload. Use Permapost#data() to add it')
        }
        if (!this._resourceId) {
            this._resourceId = this._isPublic ? this._publicDataDir + '/' + uuid() : uuid();
        }

        const progressHook = this._progressHook
        const config = {
            method: 'put',
            url: `${this._url}/${this._dir}/${this._resourceId}`,
            data: this._data,
            headers: {
                'Authorization': 'Bearer ' + this._jwt,
                'Content-Type': 'application/octet-stream'
            },
            signal: this._cancelHook ? this._cancelHook.signal : null,
            onUploadProgress(progressEvent) {
                if (progressHook) {
                    const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                    progressHook(progress);
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
            for(let tag of this._tags) {
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
            config.headers['x-amz-meta-tags'] = JSON.stringify(this._tags.filter(function(tag) {
                return tag.name !== "Public-Key";
            }));
        }

        await axios(config);
        return { resourceUrl: this._resourceId }
    }

    /**
     * 
     * @requires: 
     * - auth() 
     * - resourceId()
     */
    async downloadFile() {
        this._dir = this._filesDir;
        return await this._download();
    }

    /**
 * 
 * @requires: 
 * - auth() 
 * - resourceId()
 */
    async downloadState() {
        this._dir = this._stateDir;
        return await this._download();
    }

    async _download() {
        if (!this._jwt && !this._isPublic) {
            throw Error('Authentication is required to use permapost')
        }
        if (!this._resourceId) {
            throw Error('Missing resource id to download')
        }

        const progressHook = this._progressHook;
        const config = {
            method: 'get',
            url: `${this._url}/${this._dir}/${this._resourceId}`,
            responseType: this._responseType,
            signal: this._cancelHook ? this._cancelHook.signal : null,
            onDownloadProgress(progressEvent) {
                if (progressHook) {
                    const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                    progressHook(progress);
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
