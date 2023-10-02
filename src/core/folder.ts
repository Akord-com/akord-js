import { NodeService } from "./node";
import { actionRefs, functions } from "../constants";
import { nodeType, NodeCreateOptions } from "../types/node";
import { Folder, FolderCreateResult } from "../types/folder";

class FolderService extends NodeService<Folder> {
  objectType = nodeType.FOLDER;
  NodeType = Folder;

  /**
   * @param  {string} vaultId
   * @param  {string} name folder name
   * @param  {NodeCreateOptions} [options] parent id, etc.
   * @returns Promise with new folder id & corresponding transaction id
   */
  public async create(vaultId: string, name: string, options: NodeCreateOptions = this.defaultCreateOptions): Promise<FolderCreateResult> {
    const service = new FolderService(this.wallet, this.api);
    await service.setVaultContext(vaultId);
    service.setActionRef(actionRefs.FOLDER_CREATE);
    service.setFunction(functions.NODE_CREATE);
    service.setAkordTags((service.isPublic ? [name] : []).concat(options.tags));
    const state = {
      name: await service.processWriteString(name),
      tags: options.tags || []
    }
    const { nodeId, transactionId, object } = await service.nodeCreate<Folder>(state, { parentId: options.parentId }, options.arweaveTags);
    return { folderId: nodeId, transactionId, object };
  }
};

export {
  FolderService
}