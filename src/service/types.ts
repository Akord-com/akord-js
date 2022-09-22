import { EncryptionKeys, Wallet, AkordWallet } from "@akord/crypto";
import { ServiceInterface, LedgerService, ProtocolService } from "../service"
import { LedgerVersion } from "../client-config"
import { Api, AkordApi } from "../api";

export class ServiceFactory {

  service: ServiceInterface

  constructor(ledgerVersion: LedgerVersion, wallet: Wallet, api: Api, encryptionKeys?: EncryptionKeys) {
    switch (ledgerVersion) {
      case LedgerVersion.V1:
        this.service = new LedgerService(<AkordWallet>wallet, <AkordApi>api, encryptionKeys);
        break
      case LedgerVersion.V2:
      default:
        this.service = new ProtocolService(wallet, api, encryptionKeys);
        break
    }
  }

  serviceInstance() {
    return this.service
  }
}
