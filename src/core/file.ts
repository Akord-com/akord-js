import * as mime from "mime-types";
import PQueue, { AbortError } from 'p-queue/dist';
import { Readable } from "stream";
import { AUTH_TAG_LENGTH_IN_BYTES, IV_LENGTH_IN_BYTES, base64ToArray, digestRaw, initDigest, signHash } from "@akord/crypto";
import { Service } from "./service";
import { protocolTags, encryptionTags as encTags, fileTags, dataTags, smartweaveTags } from "../constants";
import { ApiClient } from "../api/api-client";
import { FileLike, FileSource } from "../types/file";
import { Tag, Tags } from "../types/contract";
import { getTxData, getTxMetadata } from "../arweave";
import { CONTENT_TYPE as MANIFEST_CONTENT_TYPE, FILE_TYPE as MANIFEST_FILE_TYPE } from "./manifest";
import { UDL } from "../types/udl";
import { udlToTags } from "./udl";
import { BadRequest } from "../errors/bad-request";
import { StorageType } from "../types/node";
import { StreamConverter } from "../util/stream-converter";
import { FileVersion } from "../types";

const DEFAULT_FILE_TYPE = "text/plain";
const BYTES_IN_MB = 1000000;
const DEFAULT_CHUNK_SIZE_IN_BYTES = 10 * BYTES_IN_MB;
const MINIMAL_CHUNK_SIZE_IN_BYTES = 5 * BYTES_IN_MB;
const CHUNKS_CONCURRENCY = 25;


class FileService extends Service {
  contentType = null as string;
  client: ApiClient;


  public async create(
    file: FileLike,
    options: FileUploadOptions
  ): Promise<FileUploadResult> {
    options.public = this.isPublic;
    options.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE_IN_BYTES;
    const tags = this.getFileTags(file, options);
    if (options.chunkSize < MINIMAL_CHUNK_SIZE_IN_BYTES) {
      throw new BadRequest("Chunk size can not be smaller than: " + MINIMAL_CHUNK_SIZE_IN_BYTES / BYTES_IN_MB)
    }
    if (file.size > options.chunkSize) {
      return await this.uploadChunked(file, tags, options);
    } else {
      return await this.upload(file, tags, options);
    }
  }

  public async import(fileTxId: string)
    : Promise<{ file: FileLike, resourceUri: string[] }> {
    const fileData = await getTxData(fileTxId);
    const fileMetadata = await getTxMetadata(fileTxId);
    const { name, type } = this.retrieveFileMetadata(fileTxId, fileMetadata?.tags);
    const file = await createFileLike([fileData], { name, mimeType: type, lastModified: fileMetadata?.block?.timestamp });
    const tags = this.getFileTags(file);

    const { processedData, encryptionTags } = await this.processWriteRaw(await file.arrayBuffer(), { prefixCiphertextWithIv: true, encode: false });
    const resourceHash = await digestRaw(new Uint8Array(processedData));
    tags.push(new Tag(fileTags.FILE_HASH, resourceHash));
    this.client = new ApiClient()
      .env(this.api.config)
      .data(processedData)
      .tags(tags.concat(encryptionTags))
      .public(this.isPublic)
      .storage(StorageType.S3);

    const resource = await this.client.uploadFile();
    const resourceUri = resource.resourceUri
    resourceUri.push(`${StorageType.ARWEAVE}:${fileTxId}`);
    return { file, resourceUri };
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
      udl: uploadResult.udl
    });
    return version;
  }

  public async download(fileUri: string, options: FileChunkedGetOptions = { responseType: 'arraybuffer' }): Promise<ReadableStream<Uint8Array> | ArrayBuffer> {
    const file = await this.api.downloadFile(fileUri, { responseType: 'stream' });
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
    return { resourceUri: resourceUri, resourceHash: resourceHash, encryptedKey: encryptedKey, udl: options.udl }
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
    const etags: Array<string> = [];

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
    const encryptedKey = chunkedResource.tags.find((tag) => tag.name === encTags.ENCRYPTED_KEY).value;
    etags.push(chunkedResource.resourceEtag);

    // upload the chunks in parallel
    let sourceOffset = chunkSize;
    let targetOffset = resourceChunkSize;
    const chunksQ = new PQueue({ concurrency: CHUNKS_CONCURRENCY });
    const chunksQTasks = [];
    while (sourceOffset + chunkSize < file.size) {
      const task = chunksQ.add(
        () => this.uploadChunk(file, chunkSize, sourceOffset, { digestObject, encryptedKey, targetOffset, location: chunkedResource.resourceLocation }),
        { signal: options.cancelHook?.signal })
        .catch((error) => {
          if (error instanceof AbortError) {
            return null;
          }
          throw error;
        });
      chunksQTasks.push(task);
      sourceOffset += chunkSize;
      targetOffset += resourceChunkSize;
    }
    await chunksQ.onIdle();
    
    if (options.cancelHook?.signal?.aborted) {
      return null;
    }

    chunksQTasks.forEach(async task => {
      etags.push((await task).resourceEtag); //resolved already, awaiting for type safety
    });

    // upload the last chunk
    const resourceHash = digestObject.getHash("B64")
    const fileSignatureTags = await this.getFileSignatureTags(resourceHash)
    const fileTags = tags.concat(fileSignatureTags);
    const resource = await this.uploadChunk(file, chunkSize, sourceOffset, { digestObject, encryptedKey, etags, targetOffset, tags: fileTags, location: chunkedResource.resourceLocation });

    return {
      resourceUri: resource.resourceUri,
      numberOfChunks: numberOfChunks,
      chunkSize: chunkSizeWithNonceAndIv,
      encryptedKey: encryptedKey,
      resourceHash: resourceHash,
      udl: options.udl
    };
  }

  private async uploadChunk(
    file: FileLike,
    chunkSize: number = DEFAULT_CHUNK_SIZE_IN_BYTES,
    offset: number = 0,
    options: { digestObject?: any, encryptedKey?: string, location?: string, tags?: Tags, etags?: Array<string>, targetOffset?: number } = {}) {
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

    if (options.etags && options.etags.length > 0) {
      client.etag(options.etags.join(","));
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
      return nodeJsFile.fromPath(source as string);
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
  udl?: UDL
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
  cacheOnly?: boolean,
  udl?: UDL,
  ucm?: boolean
}

export type FileDownloadOptions = Hooks & {
  path?: string,
  skipSave?: boolean,
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
  createFileLike
}
