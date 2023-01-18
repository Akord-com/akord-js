import { EncryptionKeys, Wallet } from "@akord/crypto";
import { Api } from "../api/api";
import { VaultService } from "./vault";
import { StackService } from "./stack";
import { MemoService } from "./memo";
import { MembershipService } from "./membership";
import { FolderService } from "./folder";
import { NoteService } from "./note"
import { ProfileService } from "./profile";
import { NodeService } from "./node";
import { Service } from "./service";
import { objectType } from "../constants";

export class ServiceFactory {

  service: Service

  constructor(wallet: Wallet, api: Api, objectType: objectType, encryptionKeys?: EncryptionKeys) {
    switch (objectType) {
      case "Vault":
        this.service = new VaultService(wallet, api, encryptionKeys);
        break
      case "Membership":
        this.service = new MembershipService(wallet, api, encryptionKeys);
        break
      case "Stack":
        this.service = new StackService(wallet, api, encryptionKeys);
        break
      case "Folder":
        this.service = new FolderService(wallet, api, encryptionKeys);
        break
      case "Memo":
        this.service = new MemoService(wallet, api, encryptionKeys);
        break
      case "Note":
        this.service = new NoteService(wallet, api, encryptionKeys);
        break
      case "Profile":
        this.service = new ProfileService(wallet, api, encryptionKeys);
        break
      default:
        this.service = new NodeService(wallet, api, encryptionKeys);
        break
    }
  }

  serviceInstance() {
    return this.service
  }
}
