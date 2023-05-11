import { NodeCreateOptions, NodeService } from "./node";
import { actionRefs, functions, objectType } from "../constants";
import { FileService, FileUploadResult, FileUploadOptions } from "./file";
import { FileLike } from "../types/file";
import { FileVersion, Stack, StorageType, nodeType } from "../types/node";

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
    const createOptions = {
      ...this.defaultCreateOptions,
      ...options
    }
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.STACK_CREATE);
    this.setFunction(functions.NODE_CREATE);

    const body = {
      name: await this.processWriteString(name ? name : file.name),
      versions: [await this.uploadNewFileVersion(file, createOptions)]
    };
    const { nodeId, transactionId, object } = await this.nodeCreate<Stack>(body, { parentId: createOptions.parentId });
    return { stackId: nodeId, transactionId, object };
  }

  /**
   * @param  {string} vaultId
   * @param  {string} fileTxId arweave file transaction id reference
   * @param  {NodeCreateOptions} [options] parent id, etc.
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async import(vaultId: string, fileTxId: string, options: NodeCreateOptions = this.defaultCreateOptions): Promise<StackCreateResult> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.STACK_CREATE);
    this.setFunction(functions.NODE_CREATE);

    const { file, resourceHash, resourceUrl } = await this.fileService.import(fileTxId);
    const version = new FileVersion({
      owner: await this.wallet.getAddress(),
      createdAt: JSON.stringify(Date.now()),
      name: await this.processWriteString(file.name),
      type: file.type,
      size: file.size,
      resourceUri: [`arweave:${fileTxId}`, `hash:${resourceHash}`, `s3:${resourceUrl}`],
    });
    const body = {
      name: await this.processWriteString(file.name),
      versions: [version]
    };
    const { nodeId, transactionId, object } = await this.nodeCreate<Stack>(body, { parentId: options.parentId });
    return { stackId: nodeId, transactionId, object };
  }

  /**
   * @param  {string} stackId
   * @param  {FileLike} file file object
   * @param  {FileUploadOptions} [options] progress hook, cancel hook, etc.
   * @returns Promise with corresponding transaction id
   */
  public async uploadRevision(stackId: string, file: FileLike, options: FileUploadOptions = {}): Promise<StackUpdateResult> {
    await this.setVaultContextFromNodeId(stackId, this.objectType);
    this.setActionRef(actionRefs.STACK_UPLOAD_REVISION);

    const body = {
      versions: [await this.uploadNewFileVersion(file, options)]
    };
    this.setFunction(functions.NODE_UPDATE);
    return this.nodeUpdate<Stack>(body);
  }

  /**
   * Get stack version by index, return the latest version by default
   * @param  {string} stackId
   * @param  {number} [index] stack version index
   * @returns Promise with version name & data buffer
   */
  public async getVersion(stackId: string, index?: number): Promise<{ name: string, data: ArrayBuffer }> {
    const stack = new Stack(await this.api.getNode<Stack>(stackId, objectType.STACK, this.vaultId), null);
    const version = stack.getVersion(index);
    await this.setVaultContext(stack.vaultId);
    const { fileData, headers } = await this.api.downloadFile(version.getUri(StorageType.S3), { public: this.isPublic });
    const data = await this.processReadRaw(fileData, headers);
    const name = await this.processReadString(version.name);
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
    const stack = new Stack(await this.api.getNode<Stack>(stackId, objectType.STACK, this.vaultId), null);
    return stack.getUri(type, index);
  }

  private async uploadNewFileVersion(file: FileLike, options: FileUploadOptions): Promise<FileVersion> {
    const {
      resourceTx,
      resourceUrl,
      resourceHash,
      numberOfChunks,
      chunkSize
    } = await this.fileService.create(file, options);
    const version = new FileVersion({
      owner: await this.wallet.getAddress(),
      createdAt: JSON.stringify(Date.now()),
      name: await this.processWriteString(file.name),
      type: file.type,
      size: file.size,
      resourceUri: [`arweave:${resourceTx}`, `hash:${resourceHash}`, `s3:${resourceUrl}`],
      numberOfChunks,
      chunkSize,
    });
    return version;
  }

  protected async setVaultContext(vaultId: string): Promise<void> {
    await super.setVaultContext(vaultId);
    this.fileService.setKeys(this.keys);
    this.fileService.setRawDataEncryptionPublicKey(this.dataEncrypter.publicKey);
    this.fileService.setVaultId(this.vaultId);
    this.fileService.setIsPublic(this.isPublic);
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