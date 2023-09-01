import { NodeService } from "./node";
import { actionRefs, functions, objectType } from "../constants";
import { FileService } from "./file";
import { FileUploadOptions, FileVersion, StorageType } from "../types/file";
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
   * @returns Promise with version name & data buffer
   */
  public async getVersion(stackId: string, index?: number): Promise<{ name: string, data: ArrayBuffer }> {
    const stack = new Stack(await this.api.getNode<Stack>(stackId, objectType.STACK), null);
    const version = stack.getVersion(index);
    const service = new StackService(this.wallet, this.api);
    await service.setVaultContext(stack.vaultId);
    const { fileData, metadata } = await this.api.downloadFile(version.getUri(StorageType.S3), { public: service.isPublic });
    const data = await service.processReadRaw(fileData, metadata);
    const name = await service.processReadString(version.name);
    return { name, data };
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
};

export {
  StackService
}