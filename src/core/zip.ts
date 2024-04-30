import { Service } from "./service";
import { FileLike, FileSource } from "../types/file";
import { BadRequest } from "../errors/bad-request";
import { ZipUploadOptions } from "../types/zip";
import { BYTES_IN_MB, FileOptions, MINIMAL_CHUNK_SIZE_IN_BYTES, createFileLike } from "./file";

const DEFAULT_CHUNK_SIZE_IN_BYTES = 100 * BYTES_IN_MB

class ZipService extends Service {

  /**
   * @param  {string} vaultId
   * @param  {string} name folder name
   * @param  {ZipUploadOptions} [options] parent id, etc.
   */
  public async upload(vaultId: string, fileSource: FileSource, options: ZipUploadOptions = {}): Promise<void> {
    await this.setVaultContext(vaultId);
    if (!this.vault.public) {
      throw new BadRequest("Zip upload is not supported for private vaults.")
    }
    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE_IN_BYTES;
    if (chunkSize < MINIMAL_CHUNK_SIZE_IN_BYTES) {
      throw new BadRequest("Chunk size can not be smaller than: " + MINIMAL_CHUNK_SIZE_IN_BYTES / BYTES_IN_MB)
    }
    const file = await createFileLike(fileSource, { name: 'zip' } as FileOptions);


    if (file.size > chunkSize) {
      options.chunkSize = chunkSize;
      return await this.multipartUpload(file, vaultId, options);
    } else {
      return await this.simpleUpload(file, vaultId, options);
    }
  }

  private async simpleUpload(file: FileLike, vaultId: string, options: ZipUploadOptions): Promise<void> {
    const buffer = await file.arrayBuffer()
    await this.api.uploadZip(buffer, vaultId, options)
  }

  private async multipartUpload(file: FileLike, vaultId: string, options: ZipUploadOptions): Promise<void> {
    throw new Error("Not yet implemented")
  }
};

export {
  ZipService
}