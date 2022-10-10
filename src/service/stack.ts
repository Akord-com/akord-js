import { NodeService } from "./node";
import { actionRefs, commands, objectTypes } from "../constants";
import { createThumbnail } from "./thumbnail";
import { FileService } from "./file";
import { FileStream } from "../model/file-stream";

class StackService extends NodeService {
  objectType: string = objectTypes.STACK;

  public fileService = new FileService(this.wallet, this.api);

  /**
   * @param  {string} vaultId
   * @param  {any} file file object
   * @param  {string} name stack name
   * @param  {string} [parentId] parent folder id
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async create(vaultId: string, file: FileStream, name: string, parentId?: string,
    progressHook?: (progress: number) => void, cancelHook?: AbortController):
    Promise<{
      stackId: string,
      transactionId: string
    }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.STACK_CREATE);
    this.setCommand(commands.NODE_CREATE);
    const {
      resourceTx,
      resourceUrl,
      resourceHash,
      numberOfChunks,
      chunkSize,
      thumbnailTx,
      thumbnailUrl
    } = await this.postFile(file, progressHook, cancelHook);

    const body = {
      name: await this.processWriteString(name ? name : file.name),
      files: [
        {
          postedAt: JSON.stringify(Date.now()),
          name: await this.processWriteString(file.name ? file.name : name),
          type: file.type,
          size: file.size,
          numberOfChunks: numberOfChunks,
          chunkSize: chunkSize,
          resourceTx: resourceTx,
          resourceHash: resourceHash,
          thumbnailTx: thumbnailTx
        }
      ]
    };
    const { nodeId, transactionId } = await this.nodeCreate(body, {
      parent: parentId
    }, { resourceUrl, thumbnailUrl });
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
    const { resourceTx, resourceUrl, resourceHash, thumbnailTx, thumbnailUrl } = await this.postFile(file, progressHook);

    const body = {
      files: [
        {
          postedAt: JSON.stringify(Date.now()),
          name: await this.processWriteString(file.name),
          type: file.type,
          size: file.size,
          resourceTx: resourceTx,
          resourceHash: resourceHash,
          thumbnailTx: thumbnailTx
        }
      ]
    };
    this.setCommand(commands.NODE_UPDATE);
    return this.nodeUpdate(body, null, { resourceUrl, thumbnailUrl });
  }

  /**
   * Get file stack version by index, return the latest version by default
   * @param  {string} stackId
   * @param  {string} [index] file version index
   * @returns Promise with file name & data buffer
   */
  public async getFile(stackId: string, index?: string): Promise<{ name: string, data: ArrayBuffer }> {
    const stack = await this.api.getObject(stackId, objectTypes.STACK);
    let file: any;
    if (index) {
      if (stack.state.files && stack.state.files[index]) {
        file = stack.state.files[index];
      } else {
        throw new Error("Given index: " + index + " does not exist for stack: " + stackId);
      }
    } else {
      file = stack.state.files[stack.state.files.length - 1];
    }
    await this.setVaultContext(stack.dataRoomId);
    const fileRes = await this.api.downloadFile(file.resourceUrl, this.isPublic);
    const fileBuffer = await this.processReadRaw(fileRes.fileData, fileRes.headers);
    const fileName = await this.processReadString(file.title);
    return { name: fileName, data: fileBuffer };
  }

  private async postFile(file: FileStream, progressHook?: (progress: number) => void, cancelHook?: AbortController)
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

  public async setVaultContext(vaultId: string): Promise<void> {
    await super.setVaultContext(vaultId);
    this.fileService.setKeys(this.dataEncrypter.decryptedKeys);
    this.fileService.setRawDataEncryptionPublicKey(this.dataEncrypter.publicKey);
    this.fileService.setVaultId(this.vaultId);
  }
};

export {
  StackService
}