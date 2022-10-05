import { NodeService } from "./node";
import { actionRefs, commands, objectTypes, protocolTags } from "../constants";
import { createThumbnail } from "./thumbnail";
import * as mime from "mime-types";
import { digestRaw } from "@akord/crypto";

class StackService extends NodeService {
  objectType: string = objectTypes.STACK;

  /**
   * @param  {string} vaultId
   * @param  {any} file file object
   * @param  {string} name stack name
   * @param  {string} [parentId] parent folder id
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with new stack id & corresponding transaction id
   */
  public async create(vaultId: string, file: any, name: string, parentId?: string,
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
      thumbnailTx,
      thumbnailUrl
    } = await this._postFile(file, progressHook, cancelHook);

    const body = {
      name: await super.processWriteString(name ? name : file.name),
      files: [
        {
          postedAt: JSON.stringify(Date.now()),
          name: await super.processWriteString(file.name ? file.name : name),
          type: file.type,
          size: file.size,
          resourceTx: resourceTx,
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
    const { resourceTx, resourceUrl, thumbnailTx, thumbnailUrl } = await this._postFile(file, progressHook);

    const body = {
      files: [
        {
          postedAt: JSON.stringify(Date.now()),
          name: await this.processWriteString(file.name),
          type: file.type,
          size: file.size,
          resourceTx: resourceTx,
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

  async _uploadFile(file: any, shouldBundleTransaction?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{ resourceTx: string, resourceUrl: string }> {
    let tags = {};
    if (this.isPublic) {
      const hash = await digestRaw(file.data);
      tags['File-Hash'] = hash;
      tags['File-Name'] = encodeURIComponent(file.name);
      if (file.lastModified) {
        tags['File-Modified-At'] = file.lastModified.toString();
      }
    }
    const { processedData, encryptionTags } = await this.processWriteRaw(file.data);
    const mimeType = mime.lookup(file.name);
    if (!file.type) {
      try {
        file.type = mimeType;
      } catch (e) {
        file = file.slice(0, file.size, mimeType);
      }
    }
    tags['Content-Type'] = mimeType;
    tags['File-Size'] = file.size;
    tags['File-Type'] = file.type;
    tags['Timestamp'] = JSON.stringify(Date.now());
    tags['Data-Type'] = "File";
    tags[protocolTags.VAULT_ID] = this.vaultId;
    return this.api.uploadFile(processedData, { ...tags, ...encryptionTags }, this.isPublic, shouldBundleTransaction, progressHook, cancelHook);
  }

  async _postFile(file: any, progressHook?: (progress: number) => void, cancelHook?: AbortController)
    : Promise<{ resourceTx: string, resourceUrl: string, thumbnailTx?: string, thumbnailUrl?: string }> {

    const filePromise = this._uploadFile(file, true, progressHook, cancelHook);
    try {
      const thumbnail = await createThumbnail(file);
      if (thumbnail) {
        const thumbnailPromise = this._uploadFile(thumbnail, false, progressHook);
        const results = await Promise.all([filePromise, thumbnailPromise]);
        return {
          resourceTx: results[0].resourceTx,
          resourceUrl: results[0].resourceUrl,
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
};

export {
  StackService
}