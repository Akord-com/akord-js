import { Api } from "./api"
import { ArweaveApi } from "./arweave/arweave-api"
import { DefaultApi } from "./default/api"
import { Wallet, ArweaveWallet } from "@akord/crypto"
import { ClientConfig, ApiType } from "../client-config"

export class ApiFactory {

  api: Api

  constructor(config: ClientConfig, wallet: Wallet) {
    switch (config.api) {
      default:
        this.api = new DefaultApi();
        break
      case ApiType.ARWEAVE:
        this.api = new ArweaveApi(config, (<ArweaveWallet>wallet).wallet);
        break
    }
  }

  apiInstance() {
    return this.api;
  }
}