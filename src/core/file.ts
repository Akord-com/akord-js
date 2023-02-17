import { Service } from "./service";
import { protocolTags, encryptionTags as encTags, fileTags, dataTags, smartweaveTags } from "../constants";
import { digestRaw } from "@akord/crypto";
import { Logger } from "../logger";
import { ApiClient } from "../api/api-client";
import { v4 as uuid } from "uuid";
import { FileLike } from "../types/file";
import { Blob } from 'buffer';
import fs from "fs";
import { Tag, Tags } from "../types/contract";
import { BinaryLike } from "crypto";
import { getTxData, getTxMetadata } from "../arweave";
import * as mime from "mime-types";

class FileService extends Service {
  asyncUploadTreshold = 209715200;
  chunkSize = 209715200;
  contentType = null as string;

  /**
   * Returns file as ArrayBuffer. Puts the whole file into memory. 
   * For downloading without putting whole file to memory use FileService#download()
   * @param  {string} id file resource url
   * @param  {string} vaultId
   * @param  {DownloadOptions} [options]
   * @returns Promise with file buffer
   */
  public async get(id: string, vaultId: string, options: DownloadOptions = {}): Promise<ArrayBuffer> {
    if (id && id.startsWith('public/')) {
      this.setIsPublic(true);
    } else {
      await this.setVaultContext(vaultId);
    }
    let fileBinary: ArrayBuffer;
    if (options.isChunked) {
      let currentChunk = 0;
      while (currentChunk < options.numberOfChunks) {
        const url = `${id}_${currentChunk}`;
        const chunkBinary = await this.getBinary(url, options.progressHook, options.cancelHook, options.numberOfChunks, currentChunk * this.chunkSize, options.size);
        fileBinary = this.appendBuffer(fileBinary, chunkBinary);
        currentChunk++;
      }
    } else {
      const file = await this.api.downloadFile(id, this.isPublic, options.progressHook, options.cancelHook);
      fileBinary = await this.processReadRaw(file.fileData, file.headers)
    }
    return fileBinary;
  }


  /**
   * Downloads the file keeping memory consumed (RAM) under defiend level: this#chunkSize.
   * In browser, streaming of the binary requires self hosting of mitm.html and sw.js
   * See: https://github.com/jimmywarting/StreamSaver.js#configuration
   * @param  {string} id file resource url
   * @param  {string} vaultId
   * @param  {DownloadOptions} [options]
   * @returns Promise with file buffer
   */
  public async download(id: string, vaultId: string, options: DownloadOptions = {}): Promise<void> {
    if (id && id.startsWith('public/')) {
      this.setIsPublic(true);
    } else {
      await this.setVaultContext(vaultId);
    }
    const writer = await this.stream(options.name, options.size);
    if (options.isChunked) {
      let currentChunk = 0;
      try {
        while (currentChunk < options.numberOfChunks) {
          const url = `${id}_${currentChunk}`;
          const fileBinary = await this.getBinary(url, options.progressHook, options.cancelHook, options.numberOfChunks, currentChunk * this.chunkSize, options.size);
          if (writer instanceof WritableStreamDefaultWriter) {
            await writer.ready
          }
          await writer.write(new Uint8Array(fileBinary));
          currentChunk++;
        }
      } catch (err) {
        throw new Error(err);
      } finally {
        if (writer instanceof WritableStreamDefaultWriter) {
          await writer.ready
        }
        await writer.close();
      }
    } else {
      const fileBinary = await this.getBinary(id, options.progressHook, options.cancelHook);
      await writer.write(new Uint8Array(fileBinary));
      await writer.close();
    }
  }

  public async create(
    file: FileLike,
    shouldBundleTransaction?: boolean,
    progressHook?: (progress: number, data?: any) => void,
    cancelHook?: AbortController)
    : Promise<{ resourceTx: string, resourceUrl?: string, resourceHash: string, numberOfChunks?: number, chunkSize?: number }> {
    const tags = this.getFileTags(file);
    if (file.size > this.asyncUploadTreshold) {
      return await this.uploadChunked(file, tags, progressHook, cancelHook);
    } else {
      const { processedData, encryptionTags } = await this.processWriteRaw(await file.arrayBuffer());
      const resourceHash = await digestRaw(processedData);
      tags.push(new Tag(fileTags.FILE_HASH, resourceHash));
      return { resourceHash: resourceHash, ...await this.api.uploadFile(processedData, tags.concat(encryptionTags), this.isPublic, shouldBundleTransaction, progressHook, cancelHook) };
    }
  }

  public async import(fileTxId: string)
    : Promise<{ file: FileLike, resourceHash: string, resourceUrl: string }> {
    const fileData = await getTxData(fileTxId);
    const fileMetadata = await getTxMetadata(fileTxId);
    const { name, type } = this.retrieveFileMetadata(fileTxId, fileMetadata?.tags);
    const file = await createFileLike([fileData], name, type, fileMetadata?.block?.timestamp);
    const tags = this.getFileTags(file);

    const { processedData, encryptionTags } = await this.processWriteRaw(await file.arrayBuffer());
    const resourceHash = await digestRaw(processedData);
    tags.push(new Tag(fileTags.FILE_HASH, resourceHash));
    const resource = await new ApiClient()
      .env(this.api.config)
      .auth(this.api.jwtToken)
      .data(processedData)
      .tags(tags.concat(encryptionTags))
      .public(this.isPublic)
      .bundle(false)
      .uploadFile()
    return { file, resourceHash, resourceUrl: resource.resourceUrl };
  }

  public async stream(path: string, size?: number): Promise<fs.WriteStream | WritableStreamDefaultWriter> {
    if (typeof window === 'undefined') {
      return fs.createWriteStream(path);
    }
    else {
      const streamSaver = (await import('streamsaver')).default;
      if (!streamSaver.WritableStream) {
        const pony = await import('web-streams-polyfill/ponyfill');
        streamSaver.WritableStream = pony.WritableStream as unknown as typeof streamSaver.WritableStream;
      }
      if (window.location.protocol === 'https:'
        || window.location.protocol === 'chrome-extension:'
        || window.location.hostname === 'localhost') {
        streamSaver.mitm = '/streamsaver/mitm.html';
      }

      const fileStream = streamSaver.createWriteStream(path, { size: size, writableStrategy: new ByteLengthQueuingStrategy({ highWaterMark: 3 * this.chunkSize }) });
      return fileStream.getWriter();
    }
  }

  private retrieveFileMetadata(fileTxId: string, tags: Tags = [])
    : { name: string, type: string } {
    const type =
      (tags?.find((tag: Tag) => tag.name === "Content-Type"))?.value
      || "image/jpeg";
    const name = this.retrieveDecodedTag(tags, "File-Name")
      || this.retrieveDecodedTag(tags, "Title")
      || this.retrieveDecodedTag(tags, "Name")
      || (fileTxId + "." + mime.extension(type));
    return { name, type };
  }

  private retrieveDecodedTag(tags: Tags, tagName: string) {
    const tagValue = tags?.find((tag: Tag) => tag.name === tagName)?.value;
    if (tagValue) {
      return decodeURIComponent(tagValue);
    }
    return null;
  }

  private async uploadChunked(
    file: FileLike,
    tags: Tags,
    progressHook?: (progress: number, data?: any) => void,
    cancelHook?: AbortController
  ): Promise<any> {
    let resourceUrl = uuid();
    let encryptionTags: Tags;
    let encryptedKey: string;
    let iv: Array<string> = [];
    let uploadedChunks = 0;
    let offset = 0;

    while (offset < file.size) {
      const chunk = file.slice(offset, this.chunkSize + offset);
      const { encryptedData, chunkNumber } = await this.encryptChunk(
        chunk,
        offset,
        encryptedKey
      );

      encryptionTags = encryptedData.encryptionTags;
      if (!this.isPublic) {
        iv.push(encryptionTags.find((tag) => tag.name === encTags.IV).value);
        if (!encryptedKey) {
          encryptedKey = encryptionTags.find((tag) => tag.name === encTags.ENCRYPTED_KEY).value;
        }
      }

      await this.uploadChunk(
        encryptedData,
        chunkNumber,
        tags,
        resourceUrl,
        file.size,
        progressHook,
        cancelHook
      );
      offset += this.chunkSize;
      uploadedChunks += 1;
      Logger.log("Encrypted & uploaded chunk: " + chunkNumber);
    }
    if (!this.isPublic) {
      const ivIndex = encryptionTags.findIndex((tag) => tag.name === encTags.IV);
      encryptionTags[ivIndex] = new Tag(encTags.IV, iv.join(','));
    }

    await new ApiClient()
      .env(this.api.config)
      .auth(this.api.jwtToken)
      .resourceId(resourceUrl)
      .tags(tags.concat(encryptionTags))
      .public(this.isPublic)
      .numberOfChunks(uploadedChunks)
      .asyncTransaction();

    return {
      resourceUrl: resourceUrl,
      resourceHash: resourceUrl,
      numberOfChunks: uploadedChunks,
      chunkSize: this.chunkSize
    };
  }

  private async uploadChunk(
    chunk: { processedData: ArrayBuffer, encryptionTags: Tags },
    chunkNumber: number,
    tags: Tags,
    resourceUrl: string,
    resourceSize: number,
    progressHook?: (progress: number, data?: any) => void,
    cancelHook?: AbortController
  ) {
    const resource = await new ApiClient()
      .env(this.api.config)
      .auth(this.api.jwtToken)
      .resourceId(`${resourceUrl}_${chunkNumber}`)
      .data(chunk.processedData)
      .tags(tags.concat(chunk.encryptionTags))
      .public(this.isPublic)
      .bundle(false)
      .progressHook(progressHook, chunkNumber * this.chunkSize, resourceSize)
      .cancelHook(cancelHook)
      .uploadFile()
    Logger.log("Uploaded file with id: " + resource.resourceUrl);
  }

  private async encryptChunk(chunk: Blob, offset: number, encryptedKey?: string): Promise<{
    encryptedData: { processedData: ArrayBuffer, encryptionTags: Tags },
    chunkNumber: number
  }> {
    const chunkNumber = offset / this.chunkSize;
    const arrayBuffer = await chunk.arrayBuffer();
    const encryptedData = await this.processWriteRaw(new Uint8Array(arrayBuffer), encryptedKey);
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

  private async getBinary(id: string, progressHook?: (progress: number) => void, cancelHook?: AbortController, numberOfChunks?: number, loadedSize?: number, resourceSize?: number) {
    try {
      const file = await this.api.downloadFile(id, this.isPublic, progressHook, cancelHook, numberOfChunks, loadedSize, resourceSize);
      return await this.processReadRaw(file.fileData, file.headers);
    } catch (e) {
      Logger.log(e);
      throw new Error(
        "Failed to download. Please check your network connection." +
        " Please upload the file again if problem persists and/or contact Akord support."
      );
    }
  }

  private getFileTags(file: FileLike): Tags {
    const tags = [] as Tags;
    if (this.isPublic) {
      tags.push(new Tag(fileTags.FILE_NAME, encodeURIComponent(file.name)))
      if (file.lastModified) {
        tags.push(new Tag(fileTags.FILE_MODIFIED_AT, file.lastModified.toString()));
      }
    }
    tags.push(new Tag(smartweaveTags.CONTENT_TYPE, this.contentType || file.type));
    tags.push(new Tag(fileTags.FILE_SIZE, file.size));
    tags.push(new Tag(fileTags.FILE_TYPE, file.type));
    tags.push(new Tag(protocolTags.TIMESTAMP, JSON.stringify(Date.now())));
    tags.push(new Tag(dataTags.DATA_TYPE, "File"));
    tags.push(new Tag(protocolTags.VAULT_ID, this.vaultId));
    return tags;
  }
};

type DownloadOptions = {
  size?: number,
  name?: string,
  isChunked?: boolean,
  numberOfChunks?: number,
  progressHook?: (progress: number) => void,
  cancelHook?: AbortController
}

async function createFileLike(sources: Array<BinaryLike | any>, name: string, mimeType: string, lastModified?: number)
  : Promise<FileLike> {
  if (typeof window === "undefined") {
    const node = await import("../types/file")
    return new node.NodeJs.File(sources, name, mimeType, lastModified);
  } else {
    return new File(sources, name, { type: mimeType, lastModified })
  }
}

export {
  FileService,
  createFileLike
}
