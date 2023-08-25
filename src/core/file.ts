import { Service } from "./service";
import { protocolTags, encryptionTags as encTags, fileTags, dataTags, smartweaveTags } from "../constants";
import { base64ToArray, digestRaw, signHash } from "@akord/crypto";
import { Logger } from "../logger";
import { ApiClient } from "../api/api-client";
import { v4 as uuid } from "uuid";
import { FileLike, FileSource } from "../types/file";
import { Blob } from "buffer";
import { Tag, Tags } from "../types/contract";
import { getTxData, getTxMetadata } from "../arweave";
import * as mime from "mime-types";
import { CONTENT_TYPE as MANIFEST_CONTENT_TYPE, FILE_TYPE as MANIFEST_FILE_TYPE } from "./manifest";
import { FileVersion } from "../types/node";
import { Readable } from "stream";
import { BadRequest } from "../errors/bad-request";

const DEFAULT_FILE_TYPE = "text/plain";

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
    const service = new FileService(this.wallet, this.api);
    await service.setVaultContext(vaultId);
    const downloadOptions = options as FileDownloadOptions;
    downloadOptions.public = service.isPublic;
    let fileBinary: ArrayBuffer;
    if (options.isChunked) {
      let currentChunk = 0;
      while (currentChunk < options.numberOfChunks) {
        const url = `${id}_${currentChunk}`;
        downloadOptions.loadedSize = currentChunk * this.chunkSize;
        const chunkBinary = await service.getBinary(url, downloadOptions);
        fileBinary = service.appendBuffer(fileBinary, chunkBinary);
        currentChunk++;
      }
    } else {
      const { fileData, metadata } = await this.api.downloadFile(id, downloadOptions);
      fileBinary = await service.processReadRaw(fileData, metadata)
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
    const service = new FileService(this.wallet, this.api);
    await service.setVaultContext(vaultId);
    const downloadOptions = options as FileDownloadOptions;
    downloadOptions.public = service.isPublic;
    const writer = await service.stream(options.name, options.resourceSize);
    if (options.isChunked) {
      let currentChunk = 0;
      try {
        while (currentChunk < options.numberOfChunks) {
          const url = `${id}_${currentChunk}`;
          downloadOptions.loadedSize = currentChunk * service.chunkSize;
          const fileBinary = await service.getBinary(url, downloadOptions);
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
      const fileBinary = await service.getBinary(id, downloadOptions);
      await writer.write(new Uint8Array(fileBinary));
      await writer.close();
    }
  }

  public async create(
    file: FileLike,
    options: FileUploadOptions
  ): Promise<FileUploadResult> {
    const tags = this.getFileTags(file, options);
    if (file.size > this.asyncUploadTreshold) {
      return await this.uploadChunked(file, tags, options);
    } else {
      const { processedData, encryptionTags } = await this.processWriteRaw(await file.arrayBuffer());
      const resourceHash = await digestRaw(new Uint8Array(processedData));
      const privateKeyRaw = this.wallet.signingPrivateKeyRaw();
      const signature = await signHash(
        base64ToArray(resourceHash),
        privateKeyRaw
      );
      tags.push(new Tag(fileTags.FILE_HASH, resourceHash));
      tags.push(new Tag(protocolTags.SIGNATURE, signature));
      tags.push(new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()));
      options.public = this.isPublic;
      return { resourceHash: resourceHash, ...await this.api.uploadFile(processedData, tags.concat(encryptionTags), options) };
    }
  }

  public async import(fileTxId: string)
    : Promise<{ file: FileLike, resourceHash: string, resourceUrl: string }> {
    const fileData = await getTxData(fileTxId);
    const fileMetadata = await getTxMetadata(fileTxId);
    const { name, type } = this.retrieveFileMetadata(fileTxId, fileMetadata?.tags);
    const file = await createFileLike([fileData], { name, mimeType: type, lastModified: fileMetadata?.block?.timestamp });
    const tags = this.getFileTags(file);

    const { processedData, encryptionTags } = await this.processWriteRaw(await file.arrayBuffer());
    const resourceHash = await digestRaw(new Uint8Array(processedData));
    tags.push(new Tag(fileTags.FILE_HASH, resourceHash));
    const resource = await new ApiClient()
      .env(this.api.config)
      .data(processedData)
      .tags(tags.concat(encryptionTags))
      .public(this.isPublic)
      .cacheOnly(true)
      .uploadFile()
    return { file, resourceHash, resourceUrl: resource.resourceUrl };
  }

  public async stream(path: string, size?: number): Promise<any | WritableStreamDefaultWriter> {
    if (typeof window === 'undefined') {
      const fs = (await import("fs")).default;
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

  public async newVersion(file: FileLike, uploadResult: FileUploadResult): Promise<FileVersion> {
    const version = new FileVersion({
      owner: await this.wallet.getAddress(),
      createdAt: JSON.stringify(Date.now()),
      name: await this.processWriteString(file.name),
      type: file.type,
      size: file.size,
      resourceUri: [
        `arweave:${uploadResult.resourceTx}`,
        `hash:${uploadResult.resourceHash}`,
        `s3:${uploadResult.resourceUrl}`
      ],
      numberOfChunks: uploadResult.numberOfChunks,
      chunkSize: uploadResult.chunkSize,
    });
    return version;
  }

  private retrieveFileMetadata(fileTxId: string, tags: Tags = [])
    : { name: string, type: string } {
    const type = this.retrieveFileType(tags);
    const name = this.retrieveDecodedTag(tags, "File-Name")
      || this.retrieveDecodedTag(tags, "Title")
      || this.retrieveDecodedTag(tags, "Name")
      || (fileTxId + "." + mime.extension(type));
    return { name, type };
  }

  private retrieveFileType(tags: Tags = [])
    : string {
    const contentType = this.retrieveDecodedTag(tags, "Content-Type");
    return (contentType === MANIFEST_CONTENT_TYPE ? MANIFEST_FILE_TYPE : contentType)
      || DEFAULT_FILE_TYPE;
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
    options: Hooks
  ): Promise<FileUploadResult> {
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
        options
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
    options: Hooks
  ) {
    const resource = await new ApiClient()
      .env(this.api.config)
      .resourceId(`${resourceUrl}_${chunkNumber}`)
      .data(chunk.processedData)
      .tags(tags.concat(chunk.encryptionTags))
      .public(this.isPublic)
      .cacheOnly(true)
      .progressHook(options.progressHook, chunkNumber * this.chunkSize, resourceSize)
      .cancelHook(options.cancelHook)
      .uploadFile()
    Logger.log("Uploaded file with id: " + resource.resourceUrl);
  }

  private async encryptChunk(chunk: Blob, offset: number, encryptedKey?: string): Promise<{
    encryptedData: { processedData: ArrayBuffer, encryptionTags: Tags },
    chunkNumber: number
  }> {
    const chunkNumber = offset / this.chunkSize;
    const arrayBuffer = await chunk.arrayBuffer();
    const encryptedData = await this.processWriteRaw(arrayBuffer, encryptedKey);
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

  private async getBinary(id: string, options: FileDownloadOptions) {
    try {
      options.public = this.isPublic;
      const { fileData, metadata } = await this.api.downloadFile(id, options);
      return await this.processReadRaw(fileData, metadata);
    } catch (e) {
      Logger.log(e);
      throw new Error(
        "Failed to download. Please check your network connection." +
        " Please upload the file again if problem persists and/or contact Akord support."
      );
    }
  }

  private getFileTags(file: FileLike, options: FileUploadOptions = {}): Tags {
    const tags = [] as Tags;
    if (this.isPublic) {
      tags.push(new Tag(fileTags.FILE_NAME, file.name))
      if (file.lastModified) {
        tags.push(new Tag(fileTags.FILE_MODIFIED_AT, file.lastModified.toString()));
      }
    }
    tags.push(new Tag(smartweaveTags.CONTENT_TYPE, this.contentType || file.type || DEFAULT_FILE_TYPE));
    tags.push(new Tag(fileTags.FILE_SIZE, file.size));
    tags.push(new Tag(fileTags.FILE_TYPE, file.type || DEFAULT_FILE_TYPE));
    tags.push(new Tag(protocolTags.TIMESTAMP, JSON.stringify(Date.now())));
    tags.push(new Tag(dataTags.DATA_TYPE, "File"));
    tags.push(new Tag(protocolTags.VAULT_ID, this.vaultId));
    options.arweaveTags?.map((tag: Tag) => tags.push(tag));
    return tags;
  }
};

type DownloadOptions = FileDownloadOptions & { name?: string }

export type FileUploadResult = {
  resourceTx?: string,
  resourceUrl?: string,
  resourceHash?: string,
  numberOfChunks?: number,
  chunkSize?: number,
}

export type Hooks = {
  progressHook?: (progress: number, data?: any) => void,
  cancelHook?: AbortController
}

export type FileUploadOptions = Hooks & {
  name?: string,
  mimeType?: string,
  lastModified?: number,
  public?: boolean
  cacheOnly?: boolean,
  arweaveTags?: Tags
}

export type FileDownloadOptions = Hooks & {
  public?: boolean,
  isChunked?: boolean,
  numberOfChunks?: number,
  loadedSize?: number,
  resourceSize?: number
}

async function createFileLike(source: FileSource, options: FileUploadOptions = {})
  : Promise<FileLike> {
  if (typeof window !== "undefined") {
    if (source instanceof ArrayBuffer) {
      return new File([source], options.name, { type: options.mimeType, lastModified: options.lastModified });
    } else if (source instanceof File) {
      return source;
    } else if (source instanceof Array) {
      return new File(source, options.name, { type: options.mimeType, lastModified: options.lastModified });
    }
  } else {
    const nodeJsFile = (await import("../types/file")).NodeJs.File;
    if (source instanceof Readable) {
      return nodeJsFile.fromReadable(source, options.name, options.mimeType, options.lastModified);
    } else if (source instanceof Buffer) {
      return new nodeJsFile([source as Buffer], options.name, options.mimeType, options.lastModified);
    } else if (source instanceof nodeJsFile) {
      return source;
    } else if (typeof source === "string") {
      return nodeJsFile.fromPath(source as string);
    } else if (source instanceof Array) {
      return new nodeJsFile(source, options.name, options.mimeType, options.lastModified);
    }
  }
  throw new BadRequest("File source is not supported. Please provide a valid source.");
}

export {
  FileService,
  createFileLike
}
