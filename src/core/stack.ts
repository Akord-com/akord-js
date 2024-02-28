import { NodeService } from "./node";
import { actionRefs, encryptionTags, encryptionTagsLegacy, functions, objectType } from "../constants";
import { FileDownloadOptions, FileGetOptions, FileService, FileUploadOptions, FileVersionData, createFileLike } from "./file";
import { FileSource } from "../types/file";
import { FileVersion, NodeCreateOptions, Stack, StackCreateOptions, StackCreateResult, StackUpdateResult, StorageType, nodeType } from "../types";
import { StreamConverter } from "../util/stream-converter";
import { ReadableStream } from 'web-streams-polyfill/ponyfill/es2018';
import { PROXY_DOWNLOAD_URL } from "@akord/crypto";
import { Platform, getPlatform } from "../util/platform";
import { Logger } from "../logger";
import { BadRequest } from "../errors/bad-request";
import { ARWEAVE_URL, headFileTx } from "../arweave";

class StackService extends NodeService<Stack> {
  public fileService = new FileService(this.wallet, this.api);
  objectType = nodeType.STACK;
  NodeType = Stack;

  stackCreateDefaultOptions = {
    ...this.defaultCreateOptions,
    overrideFileName: true
  }

  /**
   * @param  {string} vaultId
   * @param  {FileSource} file file source: web File object, file path, buffer or stream
   * @param  {StackCreateOptions} [options] parent id, progress hook, cancel hook, etc.
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async create(vaultId: string, file: FileSource, options: StackCreateOptions = this.stackCreateDefaultOptions):
    Promise<StackCreateResult> {
    const service = new StackService(this.wallet, this.api);
    await service.setVaultContext(vaultId);
    service.setActionRef(actionRefs.STACK_CREATE);
    service.setFunction(functions.NODE_CREATE);

    const optionsFromVault = {
      storage: service.vault.cloud ? StorageType.S3 : StorageType.ARWEAVE
    }
    const createOptions = {
      ...this.stackCreateDefaultOptions,
      ...optionsFromVault,
      ...options
    }

    const fileService = new FileService(this.wallet, this.api, service);
    fileService.contentType = this.fileService.contentType;

    const fileLike = await createFileLike(file, { ...options, name: createOptions.overrideFileName ? options.name : undefined });

    const stackName = options.name || fileLike.name;

    service.setAkordTags((service.isPublic ? [stackName] : []).concat(createOptions.tags));

    const fileUploadResult = await fileService.create(fileLike, createOptions);
    const version = await fileService.newVersion(fileLike, fileUploadResult);

    const state = {
      name: await service.processWriteString(stackName),
      versions: [version],
      tags: createOptions.tags || []
    };
    const { nodeId, transactionId, object } = await service.nodeCreate<Stack>(state, { parentId: createOptions.parentId }, options.arweaveTags);
    return { stackId: nodeId, transactionId, object, uri: object.uri };
  }

  /**
   * @param  {string} vaultId
   * @param  {string} fileTxId arweave file transaction id reference
   * @param  {NodeCreateOptions} [options] parent id, etc.
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async import(vaultId: string, fileTxId: string, options: NodeCreateOptions = this.defaultCreateOptions): Promise<StackCreateResult> {
    const service = new StackService(this.wallet, this.api);
    await service.setVaultContext(vaultId);
    if (!service.isPublic) {
      throw new BadRequest("Import is not supported on private vaults.")
    }
    service.setActionRef(actionRefs.STACK_CREATE);
    service.setFunction(functions.NODE_CREATE);

    const { name, mimeType, size } = await headFileTx(fileTxId);
    const version = new FileVersion({
      owner: await this.wallet.getAddress(),
      createdAt: JSON.stringify(Date.now()),
      name: name,
      type: mimeType,
      size: size,
      resourceUri: [StorageType.ARWEAVE + fileTxId],
      external: true
    });
    const state = {
      name: name,
      versions: [version]
    };
    const { nodeId, transactionId, object } = await service.nodeCreate<Stack>(state, { parentId: options.parentId }, options.arweaveTags);
    return { stackId: nodeId, transactionId, object, uri: object.uri };
  }

  /**
   * @param  {string} stackId
   * @param  {FileSource} file file source: web File object, file path, buffer or stream
   * @param  {FileUploadOptions} [options] progress hook, cancel hook, etc.
   * @returns Promise with corresponding transaction id
   */
  public async uploadRevision(stackId: string, file: FileSource, options: FileUploadOptions = {}): Promise<StackUpdateResult> {
    const service = new StackService(this.wallet, this.api);
    await service.setVaultContextFromNodeId(stackId, this.objectType);
    service.setActionRef(actionRefs.STACK_UPLOAD_REVISION);
    service.setFunction(functions.NODE_UPDATE);

    const optionsFromVault = {
      storage: service.vault.cloud ? StorageType.S3 : StorageType.ARWEAVE
    }
    const uploadOptions = {
      ...optionsFromVault,
      ...options
    }

    const fileService = new FileService(this.wallet, this.api, service);
    fileService.contentType = this.fileService.contentType;
    const fileLike = await createFileLike(file, options);
    const fileUploadResult = await fileService.create(fileLike, uploadOptions);
    const version = await fileService.newVersion(fileLike, fileUploadResult);

    const state = {
      versions: [version]
    };
    const { transactionId, object } = await service.nodeUpdate<Stack>(state);
    return { transactionId, object, uri: object.uri };
  }

  /**
   * Get stack version by index, return the latest version by default
   * @param  {string} stackId
   * @param  {number} [index] stack version index
   * @returns Promise with version name & data stream or buffer
   */
  public async getVersion(stackId: string, index?: number, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersionData> {
    const service = new FileService(this.wallet, this.api);
    const stackProto = await this.api.getNode<Stack>(stackId, objectType.STACK);
    const stack = new Stack(stackProto, stackProto.__keys__);
    await service.setVaultContext(stack.vaultId);
    const version = stack.getVersion(index);
    if (!service.isPublic) {
      await version.decrypt();
    }
    const uri = version.external ? version.getUri(StorageType.ARWEAVE) : version.getUri(StorageType.S3)
    const data = await service.download(uri, { responseType: options.responseType, chunkSize: version.chunkSize || version.size });
    return { ...version, data };
  }

  /**
   * Download stack version by index, return the latest version by default.
   * This method can be used for downloading the binary or previewing it in browser (use options.noSave).
   * 
   * To download the file in browser / on server:
   *    akord.stack.download(stackId, index)
   * 
   * To preview the file in browser:
   *    const url = await akord.stack.download(stackId, index, { skipSave: true })
   *    <video src={url} controls />
   * 
   * @param  {string} stackId
   * @param  {number} index stack version index
   * @param  {object} options control download behavior
   * @returns Url pointing to the downloaded / previewable file 
   */
  public async download(stackId: string, index: number = 0, options: FileDownloadOptions = {}): Promise<string> {
    let downloadPromise: Promise<string>;
    switch (getPlatform()) {
      case Platform.BrowserNoWorker:
        if (!this.isPublic) {
          Logger.warn(
            '@akord/crypto: decryption worker is not registered, falling back to in memory decryption.\n' +
            'See: https://github.com/Akord-com/akord-crypto#decryption-worker.'
          );
        }
      case Platform.Server:
        const { name, type, data } = await this.getVersion(stackId, index, { ...options, responseType: 'stream' });
        const path = options.path ? `${options.path}/${name}` : name;
        const contentType = type;
        downloadPromise = this.saveFile(path, contentType, data as ReadableStream, options.skipSave);
        break;
      case Platform.Browser:
        const service = new StackService(this.wallet, this.api);
        const stackProto = await this.api.getNode<Stack>(stackId, objectType.STACK)
        const stack = new Stack(stackProto, stackProto.__keys__);
        const version = stack.getVersion(index);
        const id = version.external ? version.getUri(StorageType.ARWEAVE) : version.getUri(StorageType.S3);

        const url = version.external ? `${ARWEAVE_URL}/${id}` : `${service.api.config.apiurl}/files/${id}`
        const proxyUrl = `${PROXY_DOWNLOAD_URL}/${id}`
        await service.setVaultContext(stack.vaultId);

        const workerMessage = {
          type: 'init',
          chunkSize: version.chunkSize,
          size: version.size,
          id: id,
          url: url
        } as Record<string, any>;

        if (!service.isPublic) {
          await version.decrypt();
          const tags = await this.api.getTransactionTags(id);
          const encryptedKey = tags.find(tag => tag.name.toLowerCase() === encryptionTags.ENCRYPTED_KEY.toLowerCase()
            || tag.name.toLowerCase() === encryptionTagsLegacy.ENCRYPTED_KEY.toLowerCase())?.value
          const iv = tags.find(tag => tag.name === encryptionTags.IV
            || tag.name.toLowerCase() === encryptionTagsLegacy.IV.toLowerCase())?.value
          const key = await service.dataEncrypter.decryptKey(encryptedKey);
          workerMessage.key = key;
          workerMessage.iv = iv;
        }
        workerMessage.name = version.name
        navigator.serviceWorker.controller.postMessage(workerMessage);

        downloadPromise = new Promise((resolve, reject) => {
          if (options.skipSave) {
            resolve(proxyUrl);
          } else {
            const interval = setInterval(() => {
              const channel = new MessageChannel();

              channel.port2.onmessage = (event) => {
                if (event.data.type === 'progress') {
                  const progress = Math.min(100, Math.ceil(event.data.progress / version.size * 100));
                  if (options.progressHook) {
                    options.progressHook(progress);
                  }
                  if (event.data.progress === version.size) {
                    clearInterval(interval);
                    resolve(version.name);
                  }
                } else {
                  reject(event.data);
                }
              };

              navigator.serviceWorker.controller.postMessage({
                type: 'progress',
                id: id
              }, [channel.port1]);
            }, 100);
          }
        });

        if (options.cancelHook) {
          options.cancelHook.signal.onabort = () => {
            navigator.serviceWorker.controller.postMessage({
              type: 'cancel',
              id: id
            });
          };
        }
        if (!options.skipSave) {
          const anchor = document.createElement('a');
          anchor.href = proxyUrl;
          document.body.appendChild(anchor);
          anchor.click();
        }
        break;
    }

    return downloadPromise
  }

  /**
   * Get stack file uri by index, return the latest file uri by default
   * @param  {string} stackId
   * @param  {StorageType} [type] storage type, default to arweave
   * @param  {number} [index] file version index, default to latest
   * @returns Promise with stack file uri
   */
  public async getUri(stackId: string, type: StorageType = StorageType.ARWEAVE, index?: number): Promise<string> {
    const stack = new Stack(await this.api.getNode<Stack>(stackId, objectType.STACK), null);
    return stack.getUri(type, index);
  }


  private async saveFile(path: string, type: string, stream: ReadableStream, skipSave: boolean = false): Promise<string> {
    if (typeof window === 'undefined') {
      const fs = (await import("fs")).default;
      const Readable = (await import("stream")).Readable;
      return new Promise((resolve, reject) =>
        Readable.from(stream).pipe(fs.createWriteStream(path))
          .on('error', error => reject(error))
          .on('finish', () => resolve(path))
      );
    } else {
      const buffer = await StreamConverter.toArrayBuffer(stream)
      const blob = new Blob([buffer], { type: type });
      const url = window.URL.createObjectURL(blob);
      if (!skipSave) {
        const a = document.createElement("a");
        a.download = path;
        a.href = url
        a.click();
      }
      return url;
    }
  }
};

export {
  StackService
}
