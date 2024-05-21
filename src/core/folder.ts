import { actionRefs, functions } from "../constants";
import { nodeType, NodeCreateOptions } from "../types/node";
import { Folder, FolderCreateResult } from "../types/folder";
import { NodeModule } from "./node";
import { Wallet } from "@akord/crypto";
import { Api } from "../api/api";
import { Service } from ".";

class FolderModule extends NodeModule<Folder> {

  constructor(wallet: Wallet, api: Api, service?: Service) {
    super(wallet, api, Folder, nodeType.FOLDER, service);
  }

  /**
   * @param  {string} vaultId
   * @param  {string} name folder name
   * @param  {NodeCreateOptions} [options] parent id, etc.
   * @returns Promise with new folder id & corresponding transaction id
   */
  public async create(vaultId: string, name: string, options: NodeCreateOptions = this.defaultCreateOptions): Promise<FolderCreateResult> {
    await this.service.setVaultContext(vaultId);
    this.service.setActionRef(actionRefs.FOLDER_CREATE);
    this.service.setFunction(functions.NODE_CREATE);
    this.service.setAkordTags((this.service.isPublic ? [name] : []).concat(options.tags));
    const state = {
      name: await this.service.processWriteString(name),
      tags: options.tags || []
    }
    const { nodeId, transactionId, object } = await this.service.nodeCreate<Folder>(state, { parentId: options.parentId }, options.arweaveTags);
    return { folderId: nodeId, transactionId, object };
  }
};

export {
  FolderModule
}