import { NodeService } from "./node";
import { actionRefs, functions, objectTypes } from "../constants";
import { createThumbnail } from "./thumbnail";
import { FileService } from "./file";
import { FileLike } from "../types/file";
import { Stack } from "../types/node";

class StackService extends NodeService<Stack> {
  public fileService = new FileService(this.wallet, this.api);
  objectType: string = objectTypes.STACK;
  NodeType = Stack;

  /**
   * @param  {string} vaultId
   * @param  {any} file file object
   * @param  {string} name stack name
   * @param  {string} [parentId] parent folder id
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async create(vaultId: string, file: FileLike, name: string, parentId?: string,
    progressHook?: (progress: number) => void, cancelHook?: AbortController):
    Promise<{
      stackId: string,
      transactionId: string
    }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.STACK_CREATE);
    this.setFunction(functions.NODE_CREATE);

    const body = {
      name: await this.processWriteString(name ? name : file.name),
      versions: [await this.uploadNewFileVersion(file, progressHook, cancelHook)]
    };
    const { nodeId, transactionId } = await this.nodeCreate(body, { parentId });
    return { stackId: nodeId, transactionId };
  }

  /**
  * @param  {string} stackId
  * @param  {any} file file object
  * @param  {(progress:number)=>void} [progressHook]
  * @returns Promise with corresponding transaction id
  */
  public async uploadRevision(stackId: string, file: any, progressHook?: (progress: number) => void): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(stackId, this.objectType);
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
   * @param  {string} [index] stack version index
   * @returns Promise with version name & data buffer
   */
  public async getVersion(stackId: string, index?: string): Promise<{ name: string, data: ArrayBuffer }> {
    const stack = await this.api.getObject<Stack>(stackId, objectTypes.STACK);
    let version: any;
    if (index) {
      if (stack.versions && stack.versions[index]) {
        version = stack.versions[index];
      } else {
        throw new Error("Given index: " + index + " does not exist for stack: " + stackId);
      }
    } else {
      version = stack.versions[stack.versions.length - 1];
    }
    await this.setVaultContext(stack.vaultId);
    const { fileData, headers } = await this.api.downloadFile(version.resourceUrl, this.isPublic);
    const data = await this.processReadRaw(fileData, headers);
    const name = await this.processReadString(version.name);
    return { name, data };
  }

  private async uploadNewFileVersion(file: any, progressHook?: any, cancelHook?: any) {
    const {
      resourceTx,
      resourceUrl,
      resourceHash,
      numberOfChunks,
      chunkSize,
      thumbnailTx,
      thumbnailUrl
    } = await this.postFile(file, progressHook, cancelHook);
    const version = {
      createdAt: JSON.stringify(Date.now()),
      name: await this.processWriteString(file.name),
      type: file.type,
      size: file.size,
      resourceUri: [`arweave:${resourceTx}`, `hash:${resourceHash}`, `s3:${resourceUrl}`],
      thumbnailUri: [`arweave:${thumbnailTx}`, `s3:${thumbnailUrl}`],
      numberOfChunks,
      chunkSize,
    }
    return version;
  }

  private async postFile(file: FileLike, progressHook?: (progress: number) => void, cancelHook?: AbortController)
    : Promise<{ resourceTx: string, resourceUrl: string, resourceHash: string, numberOfChunks?: number, chunkSize?: number, thumbnailTx?: string, thumbnailUrl?: string }> {

    const filePromise = this.fileService.create(file, true, progressHook, cancelHook);
    try {
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
    } catch (e) {
      console.log(e);
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