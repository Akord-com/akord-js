import { Service } from "./service";
import { protocolTags, encryptionTags as encTags, fileTags, dataTags, smartweaveTags } from "../constants";
import { base64ToArray, digestRaw, signHash } from "@akord/crypto";
import { Logger } from "../logger";
import { ApiClient } from "../api/api-client";
import { v4 as uuid } from "uuid";
import { DownloadOptions, FileDownloadOptions, FileUploadOptions, FileUploadResult, FileVersion, Hooks, StorageType } from "../types/file";
import { FileLike } from "../types/file-like";
import { Blob } from "buffer";
import { Tag, Tags } from "../types/contract";
import { BinaryLike } from "crypto";
import { getTxData, getTxMetadata } from "../arweave";
import * as mime from "mime-types";
import { CONTENT_TYPE as MANIFEST_CONTENT_TYPE, FILE_TYPE as MANIFEST_FILE_TYPE } from "./manifest";

const DEFAULT_FILE_TYPE = "text/plain";
const DEFAULT_CHUNK_SIZE = 1000000;
const IV_LENGTH_IN_BYTES = 16;
const DEFAULT_CHUNK_SIZE_WITH_IV = DEFAULT_CHUNK_SIZE + IV_LENGTH_IN_BYTES;

class FileService extends Service {
  //asyncUploadTreshold = 209715200;
  asyncUploadTreshold = 2000000;
  chunkSize = 1000000;
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
      const resource = await this.api.uploadFile(processedData, tags.concat(encryptionTags), options);
      const resourceUri = resource.resourceUri;
      resourceUri.push(`hash:${resourceHash}`);
      return { resourceUri: resourceUri };
    }
  }

  public async import(fileTxId: string)
    : Promise<{ file: FileLike, resourceUri: string[] }> {
    const fileData = await getTxData(fileTxId);
    const fileMetadata = await getTxMetadata(fileTxId);
    const { name, type } = this.retrieveFileMetadata(fileTxId, fileMetadata?.tags);
    const file = await createFileLike([fileData], name, type, fileMetadata?.block?.timestamp);
    const tags = this.getFileTags(file);

    const { processedData, encryptionTags } = await this.processWriteRaw(await file.arrayBuffer());
    const resourceHash = await digestRaw(new Uint8Array(processedData));
    tags.push(new Tag(fileTags.FILE_HASH, resourceHash));
    const resource = await new ApiClient()
      .env(this.api.config)
      .data(processedData)
      .tags(tags.concat(encryptionTags))
      .public(this.isPublic)
      .storage(StorageType.S3)
      .uploadFile();
    const resourceUri = resource.resourceUri
    resourceUri.push(`${StorageType.ARWEAVE}:${fileTxId}`);
    return { file, resourceUri };
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
      resourceUri: uploadResult.resourceUri,
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
    options: FileUploadOptions
  ): Promise<FileUploadResult> {
    let resource: any;
    let encryptionTags: Tags = [];
    let encryptedKey: string;
    let offset = 0;
    let offsetWithIv = 0;
    let chunkNumber = 1;
    
    const numberOfChunks = Math.ceil(file.size / DEFAULT_CHUNK_SIZE_WITH_IV);
    const fileSize = this.isPublic ? file.size : file.size + numberOfChunks * IV_LENGTH_IN_BYTES;

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + this.chunkSize);
      const arrayBuffer = await chunk.arrayBuffer();
      const encryptedData = await this.processWriteRaw(arrayBuffer, encryptedKey);

      if (!this.isPublic) {
        encryptionTags = encryptedData.encryptionTags;
        if (!encryptedKey) {
          encryptedKey = encryptionTags.find((tag) => tag.name === encTags.ENCRYPTED_KEY).value;
        }
      }

      resource = await new ApiClient()
        .env(this.api.config)
        .public(this.isPublic)
        .resourceId(resource?.resourceLocation)
        .data(encryptedData.processedData)
        .tags(tags.concat(encryptedData.encryptionTags))
        .storage(options.storage)
        .numberOfChunks(numberOfChunks)
        .loadedBytes(offsetWithIv)
        .totalBytes(fileSize)
        .progressHook(options.progressHook)
        .cancelHook(options.cancelHook)        
        .uploadFile();

      offset += DEFAULT_CHUNK_SIZE;
      offsetWithIv += encryptedData.processedData.byteLength;
      chunkNumber += 1;
      Logger.log("Encrypted & uploaded chunk: " + chunkNumber);
    }

    return {
      resourceUri: resource.resourceUri,
      numberOfChunks: numberOfChunks,
      chunkSize: this.isPublic ? this.chunkSize : this.chunkSize + IV_LENGTH_IN_BYTES
    };
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

async function createFileLike(sources: Array<BinaryLike | any>, name: string, mimeType: string, lastModified?: number)
  : Promise<FileLike> {
  if (typeof window === "undefined") {
    const node = await import("../types/file-like");
    return new node.NodeJs.File(sources, name, mimeType, lastModified);
  } else {
    return new File(sources, name, { type: mimeType, lastModified });
  }
}

export {
  FileService,
  createFileLike
}
