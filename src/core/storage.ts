import { Service } from "./service/service";
import { Wallet } from "@akord/crypto";
import { Api } from "../api/api";
import { Storage, StorageBuyOptions, StorageBuyResponse } from "../types/storage";


class StorageModule {
  protected service: Service;

  constructor(wallet: Wallet, api: Api) {
    this.service = new Service(wallet, api);
  }

  /**
   * Get storage balance
   */
  public async get(): Promise<Storage> {
    return await this.service.api.getStorageBalance();
  }

  /**
   * @param  {string} amountInGbs Number of gigabytes of storage to purchase
   * @param  {StorageBuyOptions} [options] simulate, confirm, etc.
   */
  public async buy(amountInGbs: number, options: StorageBuyOptions = {}): Promise<StorageBuyResponse> {
    if (!options.paymentId) {
      return await this.service.api.initPayment(amountInGbs, options);
    } else {
      return await this.service.api.confirmPayment(options.paymentId);
    }
  }
};

export {
  StorageModule
}
