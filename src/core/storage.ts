import { Service } from "./service/service";
import { BadRequest } from "../errors/bad-request";
import { BYTES_IN_MB, DEFAULT_CHUNK_SIZE_IN_BYTES, FileOptions, MINIMAL_CHUNK_SIZE_IN_BYTES, createFileLike } from "./file";
import { Wallet } from "@akord/crypto";
import { Api } from "../api/api";
import { Storage, StorageBuyOptions } from "../types/storage";


class StorageModule {
  protected service: Service;
  
  protected defaultBuyOptions = {
    simulate: true
  } as StorageBuyOptions;

  constructor(wallet: Wallet, api: Api) {
    this.service = new Service(wallet, api);
  }

  public async get(): Promise<Storage> {
    return await this.service.api.getStorageBalance();
  }


  /**
   * @param  {string} vaultId
   * @param  {string} name folder name
   * @param  {ZipUploadOptions} [options] parent id, etc.
   */
  public async buy(storageInGbs: number, options: StorageBuyOptions = this.defaultBuyOptions): Promise<void> {
    if (options.simulate) {
      const cost = await this.service.api.simulatePayment(storageInGbs);
      console.log(cost)
    }
    
  }
};

export {
  StorageModule
}
