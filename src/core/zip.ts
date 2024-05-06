import { Service } from "./service";
import { FileLike, FileSource } from "../types/file";
import { BadRequest } from "../errors/bad-request";
import { ZipUploadOptions } from "../types/zip";
import { BYTES_IN_MB, CHUNKS_CONCURRENCY, DEFAULT_CHUNK_SIZE_IN_BYTES, FileOptions, MINIMAL_CHUNK_SIZE_IN_BYTES, createFileLike } from "./file";
import PQueue, { AbortError } from "@esm2cjs/p-queue";


class ZipService extends Service {

  /**
   * @param  {string} vaultId
   * @param  {string} name folder name
   * @param  {ZipUploadOptions} [options] parent id, etc.
   */
  public async upload(vaultId: string, fileSource: FileSource, options: ZipUploadOptions = {}): Promise<{ sourceKey: string }> {
    await this.setVaultContext(vaultId);
    if (!this.vault.public) {
      throw new BadRequest("Zip upload is not supported for private vaults.")
    }
    const file = await createFileLike(fileSource, { name: 'zip' } as FileOptions);
    if (options.chunkSize && options.chunkSize > file.size) {
      throw new BadRequest("Chunk size can not be larger than the file size")
    }
    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE_IN_BYTES;
    if (chunkSize < MINIMAL_CHUNK_SIZE_IN_BYTES) {
      throw new BadRequest("Chunk size can not be smaller than: " + MINIMAL_CHUNK_SIZE_IN_BYTES / BYTES_IN_MB)
    }

    if (file.size > chunkSize) {
      options.chunkSize = chunkSize;
      return await this.multipartUpload(file, vaultId, options);
    } else {
      return await this.simpleUpload(file, vaultId, options);
    }
  }

  private async simpleUpload(file: FileLike, vaultId: string, options: ZipUploadOptions): Promise<{ sourceKey: string }> {
    const buffer = await file.arrayBuffer()
    return await this.api.uploadZip(buffer, vaultId, options)
  }

  private async multipartUpload(file: FileLike, vaultId: string, options: ZipUploadOptions): Promise<{ sourceKey: string }> {
    const { chunkSize, chunksConcurrency, ...initOptions } = options
    const { multipartToken } = await this.api.uploadZip(null, vaultId, { ...initOptions, multipartInit: true })
    let offset = 0;
    let partNumber = 1;
    const chunksQ = new PQueue({ concurrency: options.chunksConcurrency || CHUNKS_CONCURRENCY });
    const chunks = [];
    const apiOptions = { multipartToken: multipartToken, cancelHook: options.cancelHook, progressHook: options.progressHook }
    while (offset < file.size) {
      const buffer = await file.slice(offset, offset + options.chunkSize).arrayBuffer();
      const currentPart = partNumber;
      chunks.push(
        () => this.api.uploadZip(buffer, vaultId, { ...apiOptions, partNumber: currentPart })
      )
      offset += options.chunkSize;
      partNumber += 1;
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
    const { sourceKey } = await this.api.uploadZip(null, vaultId, { multipartToken: multipartToken, multipartComplete: true });
    return { sourceKey }
  }
};

export {
  ZipService
}
