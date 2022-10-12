import { Service } from "./service";
import { protocolTags } from "../constants";
import { digestRaw } from "@akord/crypto";
import { Logger } from "../logger";
import { PermapostExecutor } from "../api/akord/permapost";
import { v4 as uuid } from "uuid";
import { FileLike } from "../model/file";
import { Blob } from 'buffer';
import fs from "fs";


class FileService extends Service {
  chunkSize = 209715200;
  uploadInProgress = false;
  downloadInProgress = false;
  downloadCancelled = false;
  uploadedChunks = 0;
  resourceUrl = null;

  /**
   * Returns file as ArrayBuffer. Puts the whole file into memory. 
   * For downloading without putting whole file to memory use FileService#download()
   * @param  {string} id file resource url
   * @param  {string} vaultId
   * @param  {boolean} [isChunked]
   * @param  {number} [numberOfChunks]
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with file buffer
   */
  public async get(id: string, vaultId: string, isChunked?: boolean, numberOfChunks?: number, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<ArrayBuffer> {
    await this.setVaultContext(vaultId);
    let fileBinary: ArrayBuffer;
    if (isChunked) {
      let currentChunk = 0;
      while (currentChunk < numberOfChunks) {
        const url = `${id}_${currentChunk}`;
        const chunkBinary = await this.getBinary(url, progressHook, cancelHook);
        fileBinary = this.appendBuffer(fileBinary, chunkBinary);
        currentChunk++;
      }
    } else {
      const file = await this.api.downloadFile(id, this.isPublic, progressHook, cancelHook);
      fileBinary = await this.processReadRaw(file.fileData, file.headers)
    }
    return fileBinary;
  }

  /**
   * @param  {string} id file resource url
   * @param  {boolean} [isChunked]
   * @param  {number} [numberOfChunks]
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with file buffer
   */
  public async getPublic(id: string, isChunked?: boolean, numberOfChunks?: number, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<ArrayBuffer> {
    this.setIsPublic(true);
    let fileBinary
    if (isChunked) {
      let currentChunk = 0;
      while (currentChunk < numberOfChunks) {
        const url = `${id}_${currentChunk}`;
        const chunkBinary = await this.getBinary(url, progressHook, cancelHook);
        fileBinary = this.appendBuffer(fileBinary, chunkBinary);
        currentChunk++;
      }
    } else {
      fileBinary = await this.getBinary(id, progressHook, cancelHook);
    }
    return fileBinary;
  }

  /**
   * Downloads file keeping memory consumed (RAM) at defiend level: this#chunkSize.
   * In browser, streaming of the binary requires self hosting of mitm.html and sw.js
   * See: https://github.com/jimmywarting/StreamSaver.js#configuration
   * @param  {string} id file resource url
   * @param  {string} vaultId
   * @param  {boolean} [isChunked]
   * @param  {number} [numberOfChunks]
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with file buffer
   */
  public async download(id: string, vaultId: string, name: string, isChunked?: boolean, numberOfChunks?: number, progressHook?: (progress: number) => void, cancelHook?: AbortController) {
    await this.setVaultContext(vaultId);
    const writer = await this.stream(name);
    if (isChunked) {
      let currentChunk = 0;
      try {
        while (currentChunk < numberOfChunks) {
          const url = `${id}_${currentChunk}`;
          const fileBinary = await this.getBinary(url, progressHook, cancelHook);
          await writer.write(new Uint8Array(fileBinary));
          currentChunk++;
        }
      } catch (err) {
        throw new Error(err);
      } finally {
        await writer.close();
      }
    } else {
      const fileBinary = await this.getBinary(id, progressHook, cancelHook);
      await writer.write(new Uint8Array(fileBinary));
      await writer.close();
    }
  }

  public async create(
    file: FileLike,
    shouldBundleTransaction?: boolean,
    progressHook?: (progress: number) => void,
    cancelHook?: AbortController)
    : Promise<{ resourceTx: string, resourceUrl: string, resourceHash: string, numberOfChunks?: number, chunkSize?: number }> {
    let tags = {};
    if (this.isPublic) {
      tags['File-Name'] = encodeURIComponent(file.name);
      if (file.lastModified) {
        tags['File-Modified-At'] = file.lastModified.toString();
      }
    }
    tags['Content-Type'] = file.type;
    tags['File-Size'] = file.size;
    tags['File-Type'] = file.type;
    tags['Timestamp'] = JSON.stringify(Date.now());
    tags['Data-Type'] = "File";
    tags[protocolTags.VAULT_ID] = this.vaultId;
    if (file.size > this.chunkSize) {
      return await this.uploadChunked(file, progressHook, cancelHook);
    } else {
      const { processedData, encryptionTags } = await this.processWriteRaw(await file.arrayBuffer());
      tags['File-Hash'] = await digestRaw(processedData);
      console.log(tags)
      return { resourceHash: tags['File-Hash'], ...await this.api.uploadFile(processedData, { ...tags, ...encryptionTags }, this.isPublic, shouldBundleTransaction, progressHook, cancelHook) };
    }
  }

  public async stream(path: string) {
    if (typeof window === 'undefined') {
      return fs.createWriteStream(path);
    }
    else {
      const streamSaver = (await import('streamsaver')).default;
      if (!streamSaver.WritableStream) {
        const pony = await import('web-streams-polyfill/ponyfill');
        streamSaver.WritableStream = pony.WritableStream;
      }
      if (window.location.protocol === 'https:'
        || window.location.protocol === 'chrome-extension:'
        || window.location.hostname === 'localhost') {
        streamSaver.mitm = '/streamsaver/mitm.html';
      }

      const fileStream = streamSaver.createWriteStream(path);
      return fileStream.getWriter();
    }
  }

  private async uploadChunked(
    file: FileLike,
    progressHook?: (progress: number) => void,
    cancelHook?: AbortController
  ): Promise<any> {
    let offset = 0;
    let loadedProgress = 0;
    let totalProgress = 0;

    this.uploadInProgress = true;
    let resourceUrl = uuid();
    let encryptionTags;
    while (offset < file.size) {
      const chunk = file.slice(offset, this.chunkSize + offset);
      const { encryptedData, chunkNumber } = await this.encryptChunk(
        chunk,
        offset
      );
      totalProgress = file.size;
      encryptionTags = encryptedData.encryptionTags;

      loadedProgress = await this.uploadChunk(
        encryptedData,
        chunkNumber,
        resourceUrl,
        loadedProgress,
        progressHook,
        cancelHook
      );
      offset += this.chunkSize;
      this.uploadedChunks += 1;
      Logger.log("Encrypted & uploaded chunk: " + chunkNumber);
    }

    this.uploadInProgress = false;

    await new PermapostExecutor()
      .env((<any>this.api.config).env, (<any>this.api.config).domain)
      .auth(this.api.jwtToken)
      .resourceId(resourceUrl)
      .tags(encryptionTags)
      .public(this.isPublic)
      .numberOfChunks(this.uploadedChunks)
      .asyncTransaction();

    return {
      resourceUrl: resourceUrl,
      resourceHash: resourceUrl,
      numberOfChunks: this.uploadedChunks,
      chunkSize: this.chunkSize
    };
  }

  private async uploadChunk(
    chunk: { processedData: ArrayBuffer, encryptionTags: any },
    chunkNumber: number,
    resourceUrl: string,
    loadedProgress: number,
    progressHook?: (progress: number) => void,
    cancelHook?: AbortController
  ): Promise<number> {
    const resource = await new PermapostExecutor()
      .env((<any>this.api.config).env, (<any>this.api.config).domain)
      .auth(this.api.jwtToken)
      .resourceId(`${resourceUrl}_${chunkNumber}`)
      .data(chunk.processedData)
      .tags(chunk.encryptionTags)
      .public(this.isPublic)
      .bundle(false)
      .progressHook(progressHook)
      .cancelHook(cancelHook)
      .uploadFile()
    Logger.log("Uploaded file with id: " + resource.resourceUrl);
    return loadedProgress;
  }

  private async encryptChunk(chunk: Blob, offset: number): Promise<{
    encryptedData: { processedData: ArrayBuffer, encryptionTags: any },
    chunkNumber: number
  }> {
    const chunkNumber = offset / this.chunkSize;
    const arrayBuffer = await chunk.arrayBuffer();
    const encryptedData = await this.processWriteRaw(new Uint8Array(arrayBuffer));
    return { encryptedData, chunkNumber }
  }

  private appendBuffer(buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBufferLike {
    if (!buffer1 && !buffer2) return;
    if (!buffer1) return buffer2;
    if (!buffer2) return buffer1;
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  }

  private async getBinary(id: string, progressHook?: (progress: number) => void, cancelHook?: AbortController) {
    try {
      const file = await this.api.downloadFile(id, this.isPublic, progressHook, cancelHook);
      return await this.processReadRaw(file.fileData, file.headers);
    } catch (e) {
      Logger.log(e);
      throw new Error(
        "Failed to download. Please check your network connection." +
        " Please upload the file again if problem persists and/or contact Akord support."
      );
    }
  }
};

export {
  FileService
}
