import { Api } from "./api"
import { AkordApi } from "./akord/akord-api"
import { ArweaveApi } from "./arweave/arweave-api"
import { Wallet, ArweaveWallet } from "@akord/crypto"
import { ClientConfig, ApiType } from "../client-config"

export class ApiFactory {

  api: Api

  constructor(config: ClientConfig, wallet: Wallet, jwt?: string) {
    switch (config.api) {
      case ApiType.AKORD:
      default:
        this.api = new AkordApi(config, jwt);
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