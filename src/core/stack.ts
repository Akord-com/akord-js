import { NodeService } from "./node";
import { actionRefs, functions, objectType } from "../constants";
import { FileService, IV_LENGTH_IN_BYTES } from "./file";
import { FileDownloadOptions, FileGetOptions, FileUploadOptions, FileVersion, FileVersionData, StorageType } from "../types/file";
import { FileLike } from "../types/file-like";
import { nodeType, NodeCreateOptions } from "../types/node";
import { Stack, StackCreateOptions, StackCreateResult, StackUpdateResult } from "../types/stack";

class StackService extends NodeService<Stack> {
  public fileService = new FileService(this.wallet, this.api);
  objectType = nodeType.STACK;
  NodeType = Stack;

  /**
   * @param  {string} vaultId
   * @param  {FileLike} file file object
   * @param  {string} name stack name
   * @param  {StackCreateOptions} [options] parent id, progress hook, cancel hook, etc.
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async create(vaultId: string, file: FileLike, name: string, options: StackCreateOptions = this.defaultCreateOptions):
    Promise<StackCreateResult> {
    const service = new StackService(this.wallet, this.api);
    await service.setVaultContext(vaultId);
    service.setActionRef(actionRefs.STACK_CREATE);
    service.setFunction(functions.NODE_CREATE);

    const optionsFromVault = {
      storage: service.vault.cacheOnly ? StorageType.S3 : StorageType.ARWEAVE
    }
    const createOptions = {
      ...this.defaultCreateOptions,
      ...optionsFromVault,
      ...options
    }
    service.setAkordTags((service.isPublic ? [name] : []).concat(createOptions.tags));

    const fileService = new FileService(this.wallet, this.api, service);
    fileService.contentType = this.fileService.contentType;
    const fileUploadResult = await fileService.create(file, createOptions);
    const version = await fileService.newVersion(file, fileUploadResult);

    const state = {
      name: await service.processWriteString(name ? name : file.name),
      versions: [version],
      tags: createOptions.tags || []
    };
    const { nodeId, transactionId, object } = await service.nodeCreate<Stack>(state, { parentId: createOptions.parentId }, options.arweaveTags);
    return { stackId: nodeId, transactionId, object };
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
    service.setActionRef(actionRefs.STACK_CREATE);
    service.setFunction(functions.NODE_CREATE);

    const fileService = new FileService(this.wallet, this.api, service);
    const { file, resourceUri } = await fileService.import(fileTxId);
    const version = new FileVersion({
      owner: await this.wallet.getAddress(),
      createdAt: JSON.stringify(Date.now()),
      name: await service.processWriteString(file.name),
      type: file.type,
      size: file.size,
      resourceUri: resourceUri,
    });
    const state = {
      name: await service.processWriteString(file.name),
      versions: [version]
    };
    const { nodeId, transactionId, object } = await service.nodeCreate<Stack>(state, { parentId: options.parentId }, options.arweaveTags);
    return { stackId: nodeId, transactionId, object };
  }

  /**
   * @param  {string} stackId
   * @param  {FileLike} file file object
   * @param  {FileUploadOptions} [options] progress hook, cancel hook, etc.
   * @returns Promise with corresponding transaction id
   */
  public async uploadRevision(stackId: string, file: FileLike, options: FileUploadOptions = {}): Promise<StackUpdateResult> {
    const service = new StackService(this.wallet, this.api);
    await service.setVaultContextFromNodeId(stackId, this.objectType);
    service.setActionRef(actionRefs.STACK_UPLOAD_REVISION);
    service.setFunction(functions.NODE_UPDATE);

    const optionsFromVault = {
      storage: service.object.__cacheOnly__ ? StorageType.S3 : StorageType.ARWEAVE
    }
    const uploadOptions = {
      ...optionsFromVault,
      ...options
    }

    const fileService = new FileService(this.wallet, this.api, service);
    fileService.contentType = this.fileService.contentType;
    const fileUploadResult = await fileService.create(file, options);
    const version = await fileService.newVersion(file, fileUploadResult);

    const state = {
      versions: [version]
    };
    return service.nodeUpdate<Stack>(state);
  }

  /**
   * Get stack version by index, return the latest version by default
   * @param  {string} stackId
   * @param  {number} [index] stack version index
   * @returns Promise with version name & data stream or buffer
   */
  public async getVersion(stackId: string, index: number = 0, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersionData> {
    const service = new StackService(this.wallet, this.api);
    const stackProto = await this.api.getNode<Stack>(stackId, objectType.STACK);
    const stack = new Stack(stackProto, stackProto.__keys__);
    const version = stack.getVersion(index);
    if (!service.isPublic) {
      await version.decrypt();
    }
    await service.setVaultContext(stack.vaultId);

    const file = await this.api.downloadFile(version.getUri(StorageType.S3), { responseType: 'stream' });
    let stream: ReadableStream<Uint8Array>
    if (service.isPublic) {
      stream = file.fileData as ReadableStream<Uint8Array>
    } else {
      const encryptedKey = version.encryptedKey || file.metadata.encryptedKey;
      const iv = version.iv || file.metadata.iv?.split(',');
      const streamChunkSize = version.chunkSize || version.size + IV_LENGTH_IN_BYTES;
      stream = await service.dataEncrypter.decryptStream(file.fileData as ReadableStream, encryptedKey, iv, streamChunkSize);
    }

    let data: ReadableStream<Uint8Array> | ArrayBuffer;
    if (options.responseType === 'arraybuffer') {
      data = await new Response(stream).arrayBuffer();
    } else {
      data = stream;
    }
    return { ...version, data };
  }

  /**
   * Download stack version by index, return the latest version by default
   * @param  {string} stackId
   * @param  {number} [index] stack version index
   * @returns Promise with version name & data buffer
   */
  public async download(stackId: string, index: number = 0, options: FileDownloadOptions = {}): Promise<void> {
    let downloadPromise: Promise<void>
    if (typeof window === 'undefined' || !navigator.serviceWorker?.controller) {
      const { name, type, data } = await this.getVersion(stackId, index, { ...options, responseType: 'stream' });
      const path = `${options.path}/${name}`;
      const contentType = type;
      downloadPromise = this.saveFile(path, contentType, data);
    } else {
      const service = new StackService(this.wallet, this.api);
      const stackProto = await this.api.getNode<Stack>(stackId, objectType.STACK)
      const stack = new Stack(stackProto, stackProto.__keys__);
      const version = stack.getVersion(index);
      const id = version.getUri(StorageType.S3);
      if (!service.isPublic) {
        await version.decrypt();
      }
      await service.setVaultContext(stack.vaultId);

      const key = await service.dataEncrypter.decryptKey(version.encryptedKey);
      navigator.serviceWorker.controller.postMessage({
        type: 'init',
        key: key,
        chunkSize: version.chunkSize || (version.size + IV_LENGTH_IN_BYTES),
        size: version.size,
        name: version.name,
        iv: version.iv,
        id: id,
        url: `${service.api.config.storageurl}/${id}`
      });

      downloadPromise = new Promise((resolve, reject) => {
        if (options.skipSave) {
          resolve();
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
                  resolve();
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
      })

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
        anchor.href = `/api/proxy/download/${id}`;
        document.body.appendChild(anchor);
        anchor.click();
      }
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


  private async saveFile(path: string, type: string, stream: any): Promise<void> {
    if (typeof window === 'undefined') {
      const fs = (await import("fs")).default;
      const Readable = (await import("stream")).Readable;
      return new Promise((resolve, reject) =>
        Readable.from(stream).pipe(fs.createWriteStream(path))
          .on('error', error => reject(error))
          .on('finish', () => resolve())
      );
    } else {
      const chunks = [];
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        chunks.push(value);
      }
      const blob = new Blob(chunks, { type: type });
      const a = document.createElement("a");
      a.download = path;
      a.href = window.URL.createObjectURL(blob);
      a.click();
    }
  }
};

export {
  StackService
}
