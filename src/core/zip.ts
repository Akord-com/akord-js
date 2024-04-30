import { Service } from "./service";
import { FileSource } from "../types/file";
import { BadRequest } from "../errors/bad-request";
import { ZipUploadOptions } from "../types/zip";
import { createFileLike } from "./file";

class ZipService extends Service {

  /**
   * @param  {string} vaultId
   * @param  {string} name folder name
   * @param  {ZipUploadOptions} [options] parent id, etc.
   */
  public async upload(vaultId: string, file: FileSource, options: ZipUploadOptions = {}): Promise<void> {
    await this.setVaultContext(vaultId);
    if (!this.vault.public) {
      throw new BadRequest("Zip upload is not supported for private vaults.")
    }

    const fileLike = await createFileLike(file);
    // const stream = await fileLike.stream() as ReadableStream;

    await this.api.uploadZip(fileLike, vaultId, options)
  }
};

export {
  ZipService
}