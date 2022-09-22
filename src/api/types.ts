import { Api } from "./api"
import { AkordApi } from "./akord/akord-api"
import { ArweaveApi } from "./arweave/arweave-api"
import { WalletType, Wallet, ArweaveWallet } from "@akord/crypto"
import { ClientConfig } from "../client-config"

export class ApiFactory {

  api: Api

  constructor(config: ClientConfig, wallet: Wallet, jwt?: string) {
    switch (config.wallet) {
      case WalletType.Akord:
      default:
        this.api = new AkordApi(config, jwt)
        break
      case WalletType.Arweave:
        this.api = new ArweaveApi(config, (<ArweaveWallet>wallet).wallet)
        break
    }
  }

  apiInstance() {
    return this.api;
  }
}