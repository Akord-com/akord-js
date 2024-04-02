import * as mime from "mime-types";
import PQueue, { AbortError } from '@esm2cjs/p-queue';
import { Readable } from "stream";
import { AUTH_TAG_LENGTH_IN_BYTES, IV_LENGTH_IN_BYTES, base64ToArray, digestRaw, initDigest, signHash } from "@akord/crypto";
import { Service } from "./service";
import { protocolTags, encryptionTags as encTags, fileTags, dataTags, smartweaveTags } from "../constants";
import { ApiClient } from "../api/api-client";
import { FileLike, FileSource } from "../types/file";
import { Tag, Tags } from "../types/contract";
import { UDL } from "../types/udl";
import { formatUDL, udlToTags } from "./udl";
import { BadRequest } from "../errors/bad-request";
import { StorageType } from "../types/node";
import { StreamConverter } from "../util/stream-converter";
import { FileVersion } from "../types";

const DEFAULT_FILE_TYPE = "text/plain";
const BYTES_IN_MB = 1000000;
const DEFAULT_CHUNK_SIZE_IN_BYTES = 10 * BYTES_IN_MB;
const MINIMAL_CHUNK_SIZE_IN_BYTES = 5 * BYTES_IN_MB;
const CHUNKS_CONCURRENCY = 25;
const UPLOADER_POLLING_RATE_IN_MILLISECONDS = 2500;


class FileService extends Service {
  contentType = null as string;
  client: ApiClient;


  public async create(
    file: FileLike,
    options: FileUploadOptions
  ): Promise<FileUploadResult> {
    options.public = this.isPublic;
    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE_IN_BYTES;
    if (chunkSize < MINIMAL_CHUNK_SIZE_IN_BYTES) {
      throw new BadRequest("Chunk size can not be smaller than: " + MINIMAL_CHUNK_SIZE_IN_BYTES / BYTES_IN_MB)
    }
    if (file.size > chunkSize) {
      options.chunkSize = chunkSize;
      const tags = this.getFileTags(file, options);
      return await this.uploadChunked(file, tags, options);
    } else {
      const tags = this.getFileTags(file, options);
      return await this.upload(file, tags, options);
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
      udl: uploadResult.udl,
      ucm: uploadResult.ucm
    });
    return version;
  }

  public async download(fileUri: string, options: FileChunkedGetOptions = { responseType: 'arraybuffer' }): Promise<ReadableStream<Uint8Array> | ArrayBuffer> {
    const file = await this.api.downloadFile(fileUri, { responseType: 'stream', public: this.isPublic });
    let stream: ReadableStream<Uint8Array>;
    if (this.isPublic) {
      stream = file.fileData as ReadableStream<Uint8Array>;
    } else {
      const encryptedKey = file.metadata.encryptedKey;
      const iv = file.metadata.iv?.split(',');
      const streamChunkSize = options.chunkSize ? options.chunkSize + AUTH_TAG_LENGTH_IN_BYTES + (iv ? 0 : IV_LENGTH_IN_BYTES) : null;
      stream = await this.dataEncrypter.decryptStream(file.fileData as ReadableStream, encryptedKey, streamChunkSize, iv);
    }

    if (options.responseType === 'arraybuffer') {
      return await StreamConverter.toArrayBuffer<Uint8Array>(stream as any);
    }
    return stream;
  }

  private async upload(
    file: FileLike,
    tags: Tags,
    options: FileUploadOptions
  ): Promise<FileUploadResult> {
    const isPublic = options.public || this.isPublic
    let encryptedKey: string

    const { processedData, encryptionTags } = await this.processWriteRaw(await file.arrayBuffer(), { prefixCiphertextWithIv: true, encode: false });
    const resourceHash = await digestRaw(new Uint8Array(processedData));
    const fileSignatureTags = await this.getFileSignatureTags(resourceHash)
    const resource = await this.api.uploadFile(processedData, tags.concat(encryptionTags).concat(fileSignatureTags), options);
    const resourceUri = resource.resourceUri;
    resourceUri.push(`hash:${resourceHash}`);
    if (!isPublic) {
      encryptedKey = encryptionTags.find((tag) => tag.name === encTags.ENCRYPTED_KEY).value;
    }
    return {
      resourceUri: resourceUri,
      resourceHash: resourceHash,
      encryptedKey: encryptedKey,
      udl: formatUDL(options.udl),
      ucm: options.ucm
    }
  }

  private async uploadChunked(
    file: FileLike,
    tags: Tags,
    options: FileUploadOptions
  ): Promise<FileUploadResult> {

    const isPublic = options.public || this.isPublic
    const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE_IN_BYTES;
    const chunkSizeWithNonceAndIv = isPublic ? chunkSize : chunkSize + AUTH_TAG_LENGTH_IN_BYTES + IV_LENGTH_IN_BYTES;
    const numberOfChunks = Math.ceil(file.size / chunkSize);
    const fileSize = isPublic ? file.size : file.size + numberOfChunks * (AUTH_TAG_LENGTH_IN_BYTES + IV_LENGTH_IN_BYTES);

    this.client = new ApiClient()
      .env(this.api.config)
      .public(this.isPublic)
      .tags(tags)
      .storage(options.storage)
      .numberOfChunks(numberOfChunks)
      .totalBytes(fileSize)
      .progressHook(options.progressHook)
      .cancelHook(options.cancelHook)

    const digestObject = initDigest();

    // upload the first chunk
    const chunkedResource = await this.uploadChunk(file, chunkSize, 0, { digestObject, tags: tags });
    const resourceChunkSize = chunkedResource.resourceSize;
    const encryptedKey = chunkedResource.tags.find((tag) => tag.name === encTags.ENCRYPTED_KEY)?.value;

    // upload the chunks in parallel
    let sourceOffset = chunkSize;
    let targetOffset = resourceChunkSize;
    const chunksQ = new PQueue({ concurrency: CHUNKS_CONCURRENCY });
    const chunks = [];
    while (sourceOffset + chunkSize < file.size) {
      const localSourceOffset = sourceOffset;
      const localTargetOffset = targetOffset;
      chunks.push(
        () => this.uploadChunk(file, chunkSize, localSourceOffset, { digestObject, encryptedKey, targetOffset: localTargetOffset, location: chunkedResource.resourceLocation }),
      )
      sourceOffset += chunkSize;
      targetOffset += resourceChunkSize;
    }
    try {
      await chunksQ.addAll(chunks, { signal: options.cancelHook?.signal });
    } catch (error) {
      if (!(error instanceof AbortError) && !options.cancelHook?.signal?.aborted) {
        throw error;
      }
    }
    if (options.cancelHook?.signal?.aborted) {
      throw new AbortError();
    }

    // upload the last chunk
    const resourceHash = digestObject.getHash("B64")
    const fileSignatureTags = await this.getFileSignatureTags(resourceHash)
    const fileTags = tags.concat(fileSignatureTags);
    const resource = await this.uploadChunk(file, chunkSize, sourceOffset, { digestObject, encryptedKey, targetOffset, tags: fileTags, location: chunkedResource.resourceLocation });

    // polling loop
    if (!options.cloud) {
      const uri = chunkedResource.resourceLocation.split(":")[0];
      while (true) {
        await new Promise(resolve => setTimeout(resolve, UPLOADER_POLLING_RATE_IN_MILLISECONDS));
        const state = await this.api.getUploadState(uri);
        if (state && state.resourceUri) {
          resource.resourceUri = state.resourceUri;
          break;
        }
      }
    }

    return {
      resourceUri: resource.resourceUri,
      numberOfChunks: numberOfChunks,
      chunkSize: chunkSizeWithNonceAndIv,
      encryptedKey: encryptedKey,
      resourceHash: resourceHash,
      udl: formatUDL(options.udl),
      ucm: options.ucm
    };
  }

  private async uploadChunk(
    file: FileLike,
    chunkSize: number = DEFAULT_CHUNK_SIZE_IN_BYTES,
    offset: number = 0,
    options: { digestObject?: any, encryptedKey?: string, location?: string, tags?: Tags, targetOffset?: number } = {}) {
    const chunk = file.slice(offset, offset + chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();
    const data = await this.processWriteRaw(arrayBuffer, { encryptedKey: options.encryptedKey, prefixCiphertextWithIv: true, encode: false });
    if (options.digestObject) {
      options.digestObject.update(new Uint8Array(data.processedData));
    }

    const loadedBytes = options.targetOffset ?? offset;
    const client = this.client
      .clone()
      .data(data.processedData)
      .loadedBytes(loadedBytes);

    if (options.location) {
      client.resourceId(options.location);
    }

    if (options.tags && options.tags.length > 0) {
      client.tags([...options.tags, ...data.encryptionTags]);
    }

    const res = await client.uploadFile();
    return { ...res, tags: data.encryptionTags };
  }

  private getFileTags(file: FileLike, options: FileUploadOptions = {}): Tags {
    const tags = [] as Tags;
    if (this.isPublic) {
      tags.push(new Tag(fileTags.FILE_NAME, file.name))
      if (file.lastModified) {
        tags.push(new Tag(fileTags.FILE_MODIFIED_AT, file.lastModified.toString()));
      }
    }
    tags.push(new Tag(fileTags.FILE_SIZE, file.size));
    tags.push(new Tag(fileTags.FILE_TYPE, file.type || DEFAULT_FILE_TYPE));
    if (options.chunkSize) {
      tags.push(new Tag(fileTags.FILE_CHUNK_SIZE, options.chunkSize));
    }
    tags.push(new Tag(smartweaveTags.CONTENT_TYPE, this.contentType || file.type || DEFAULT_FILE_TYPE));
    tags.push(new Tag(protocolTags.TIMESTAMP, JSON.stringify(Date.now())));
    tags.push(new Tag(dataTags.DATA_TYPE, "File"));
    tags.push(new Tag(protocolTags.VAULT_ID, this.vaultId));

    options.arweaveTags?.map((tag: Tag) => tags.push(tag));
    if (options.udl) {
      const udlTags = udlToTags(options.udl);
      tags.push(...udlTags);
    }
    return tags;
  }

  private async getFileSignatureTags(resourceHash: string): Promise<Tags> {
    const privateKeyRaw = this.wallet.signingPrivateKeyRaw();
    const signature = await signHash(
      base64ToArray(resourceHash),
      privateKeyRaw
    );
    return [new Tag(protocolTags.SIGNATURE, signature), new Tag(fileTags.FILE_HASH, resourceHash)];
  }
};

async function createFileLike(source: FileSource, options: FileOptions = {})
  : Promise<FileLike> {
  const name = options.name || (source as any).name;
  const mimeType = options.mimeType || mime.lookup(name) || '';
  if (typeof window !== "undefined") {
    if (source instanceof Uint8Array || source instanceof Buffer || source instanceof ArrayBuffer || source instanceof Blob) {
      if (!name) {
        throw new BadRequest("File name is required, please provide it in the file options.");
      }
      if (!mimeType) {
        console.warn("Missing file mime type. If this is unintentional, please provide it in the file options.");
      }
      return new File([source as any], name, { type: mimeType, lastModified: options.lastModified });
    } else if (source instanceof File) {
      return source;
    } else if (source instanceof Array) {
      if (!name) {
        throw new BadRequest("File name is required, please provide it in the file options.");
      }
      if (!mimeType) {
        console.warn("Missing file mime type. If this is unintentional, please provide it in the file options.");
      }
      return new File(source, name, { type: mimeType, lastModified: options.lastModified });
    }
  } else {
    const nodeJsFile = (await import("../types/file")).NodeJs.File;
    if (source instanceof Readable) {
      return nodeJsFile.fromReadable(source, name, mimeType, options.lastModified);
    } else if (source instanceof Uint8Array || source instanceof Buffer || source instanceof ArrayBuffer) {
      return new nodeJsFile([source as any], name, mimeType, options.lastModified);
    } else if (source instanceof nodeJsFile) {
      return source;
    } else if (typeof source === "string") {
      return nodeJsFile.fromPath(source, name, mimeType, options.lastModified);
    } else if (source instanceof Array) {
      return new nodeJsFile(source, name, mimeType, options.lastModified);
    }
  }
  throw new BadRequest("File source is not supported. Please provide a valid source: web File object, file path, buffer or stream.");
}

export type FileUploadResult = {
  resourceUri: string[],
  resourceHash?: string,
  numberOfChunks?: number,
  chunkSize?: number,
  iv?: string[]
  encryptedKey?: string,
  udl?: UDL,
  ucm?: boolean
}

export type Hooks = {
  progressHook?: (percentageProgress: number, bytesProgress?: number, id?: string) => void,
  cancelHook?: AbortController
}

export type FileOptions = {
  name?: string,
  mimeType?: string,
  lastModified?: number
}

export type FileUploadOptions = Hooks & FileOptions & {
  public?: boolean,
  storage?: StorageType,
  arweaveTags?: Tags,
  chunkSize?: number
  cloud?: boolean,
  udl?: UDL,
  ucm?: boolean
}

export type FileDownloadOptions = Hooks & {
  path?: string,
  skipSave?: boolean,
  public?: boolean,
}

export type FileGetOptions = FileDownloadOptions & {
  responseType?: 'arraybuffer' | 'stream',
}

export type FileChunkedGetOptions = {
  responseType?: 'arraybuffer' | 'stream',
  chunkSize?: number
}

export type FileVersionData = {
  [K in keyof FileVersion]?: FileVersion[K]
} & {
  data: ReadableStream<Uint8Array> | ArrayBuffer
}

export {
  FileService,
  createFileLike,
  DEFAULT_FILE_TYPE
}
