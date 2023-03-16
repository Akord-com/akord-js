import { NodeService } from "./node";
import { actionRefs, functions, objectType } from "../constants";
import { createThumbnail } from "./thumbnail";
import { FileService } from "./file";
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
   * @param  {string} [parentId] parent folder id
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async create(vaultId: string, file: FileLike, name: string, parentId?: string,
    progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController):
    Promise<{
      stackId: string,
      transactionId: string,
      stack: Stack
    }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.STACK_CREATE);
    this.setFunction(functions.NODE_CREATE);

    const body = {
      name: await this.processWriteString(name ? name : file.name),
      versions: [await this.uploadNewFileVersion(file, progressHook, cancelHook)]
    };
    const { nodeId, transactionId, object } = await this.nodeCreate<Stack>(body, { parentId });
    return { stackId: nodeId, transactionId, stack: object };
  }

  /**
   * @param  {string} vaultId
   * @param  {string} fileTxId arweave file transaction id reference
   * @param  {string} [parentId] parent folder id
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async import(vaultId: string, fileTxId: string, parentId?: string):
    Promise<{
      stackId: string,
      transactionId: string
    }> {
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
    const { nodeId, transactionId } = await this.nodeCreate(body, { parentId });
    return { stackId: nodeId, transactionId };
  }

  /**
  * @param  {string} stackId
  * @param  {FileLike} file file object
  * @param  {(progress:number)=>void} [progressHook]
  * @returns Promise with corresponding transaction id
  */
  public async uploadRevision(stackId: string, file: FileLike, progressHook?: (progress: number, data?: any) => void): Promise<{ transactionId: string }> {
    await this.setVaultContextFromNodeId(stackId, this.objectType);
    this.setActionRef(actionRefs.STACK_UPLOAD_REVISION);

    const body = {
      versions: [await this.uploadNewFileVersion(file, progressHook)]
    };
    this.setFunction(functions.NODE_UPDATE);
    return this.nodeUpdate(body);
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
    const { fileData, headers } = await this.api.downloadFile(version.getUri(StorageType.S3), this.isPublic);
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

  private async uploadNewFileVersion(file: FileLike, progressHook?: any, cancelHook?: any): Promise<FileVersion> {
    const {
      resourceTx,
      resourceUrl,
      resourceHash,
      numberOfChunks,
      chunkSize,
      thumbnailTx,
      thumbnailUrl
    } = await this.postFile(file, progressHook, cancelHook);
    const version = new FileVersion({
      owner: await this.wallet.getAddress(),
      createdAt: JSON.stringify(Date.now()),
      name: await this.processWriteString(file.name),
      type: file.type,
      size: file.size,
      resourceUri: [`arweave:${resourceTx}`, `hash:${resourceHash}`, `s3:${resourceUrl}`],
      thumbnailUri: [`arweave:${thumbnailTx}`, `s3:${thumbnailUrl}`],
      numberOfChunks,
      chunkSize,
    });
    return version;
  }

  private async postFile(file: FileLike, progressHook?: (progress: number, data?: any) => void, cancelHook?: AbortController)
    : Promise<{ resourceTx: string, resourceHash: string, resourceUrl?: string, numberOfChunks?: number, chunkSize?: number, thumbnailTx?: string, thumbnailUrl?: string }> {
    const filePromise = this.fileService.create(file, true, progressHook, cancelHook);
    const thumbnail = await createThumbnail(file);
    if (thumbnail) {
      const thumbnailPromise = this.fileService.create(thumbnail, false, progressHook);
      const results = await Promise.all([filePromise, thumbnailPromise]);
      return {
        resourceTx: results[0].resourceTx,
        resourceUrl: results[0].resourceUrl,
        resourceHash: results[0].resourceHash,
        numberOfChunks: results[0].numberOfChunks,
        thumbnailTx: results[1].resourceTx,
        thumbnailUrl: results[1].resourceUrl
      };
    } else {
      return await filePromise;
    }
  }

  protected async setVaultContext(vaultId: string): Promise<void> {
    await super.setVaultContext(vaultId);
    this.fileService.setKeys(this.membershipKeys);
    this.fileService.setRawDataEncryptionPublicKey(this.dataEncrypter.publicKey);
    this.fileService.setVaultId(this.vaultId);
    this.fileService.setIsPublic(this.isPublic);
  }
};

export {
  StackService
}