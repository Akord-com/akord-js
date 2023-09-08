import { NodeCreateOptions, NodeService } from "./node";
import { actionRefs, functions, objectType } from "../constants";
import { FileService, FileUploadOptions, createFileLike } from "./file";
import { FileSource } from "../types/file";
import { FileVersion, Stack, StorageType, nodeType } from "../types/node";

class StackService extends NodeService<Stack> {
  public fileService = new FileService(this.wallet, this.api);
  objectType = nodeType.STACK;
  NodeType = Stack;

  /**
   * @param  {string} vaultId
   * @param  {FileSource} file file source: web File object, file path, buffer or stream
   * @param  {string} name stack name
   * @param  {StackCreateOptions} [options] parent id, progress hook, cancel hook, etc.
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async create(vaultId: string, file: FileSource, name: string, options: StackCreateOptions = this.defaultCreateOptions):
    Promise<StackCreateResult> {
    const createOptions = {
      ...this.defaultCreateOptions,
      ...options
    }
    const service = new StackService(this.wallet, this.api);
    await service.setVaultContext(vaultId);
    service.setActionRef(actionRefs.STACK_CREATE);
    service.setFunction(functions.NODE_CREATE);
    service.setAkordTags((service.isPublic ? [name] : []).concat(createOptions.tags));

    createOptions.cacheOnly = service.vault.cacheOnly;

    const fileService = new FileService(this.wallet, this.api, service);
    const fileLike = await createFileLike(file, { name, ...options });
    const fileUploadResult = await fileService.create(fileLike, createOptions);
    const version = await fileService.newVersion(fileLike, fileUploadResult);

    const state = {
      name: await service.processWriteString(name ? name : fileLike.name),
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
    const { file, resourceHash, resourceUrl } = await fileService.import(fileTxId);
    const version = new FileVersion({
      owner: await this.wallet.getAddress(),
      createdAt: JSON.stringify(Date.now()),
      name: await service.processWriteString(file.name),
      type: file.type,
      size: file.size,
      resourceUri: [`arweave:${fileTxId}`, `hash:${resourceHash}`, `s3:${resourceUrl}`],
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
   * @param  {FileSource} file file source: web File object, file path, buffer or stream
   * @param  {FileUploadOptions} [options] progress hook, cancel hook, etc.
   * @returns Promise with corresponding transaction id
   */
  public async uploadRevision(stackId: string, file: FileSource, options: FileUploadOptions = {}): Promise<StackUpdateResult> {
    const service = new StackService(this.wallet, this.api);
    await service.setVaultContextFromNodeId(stackId, this.objectType);
    service.setActionRef(actionRefs.STACK_UPLOAD_REVISION);
    service.setFunction(functions.NODE_UPDATE);

    options.cacheOnly = service.object.__cacheOnly__;

    const fileService = new FileService(this.wallet, this.api, service);
    const fileLike = await createFileLike(file, options);
    const fileUploadResult = await fileService.create(fileLike, options);
    const version = await fileService.newVersion(fileLike, fileUploadResult);

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
   * Get stack file uri by index, return the latest arweave uri by default
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

export type StackCreateOptions = NodeCreateOptions & FileUploadOptions;

type StackCreateResult = {
  stackId: string,
  transactionId: string,
  object: Stack
}

type StackUpdateResult = {
  transactionId: string,
  object: Stack
}

export {
  StackService
}