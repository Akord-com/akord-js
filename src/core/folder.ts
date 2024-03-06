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
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.FOLDER_CREATE);
    this.setFunction(functions.NODE_CREATE);
    this.setAkordTags((this.isPublic ? [name] : []).concat(options.tags));
    const state = {
      name: await this.processWriteString(name),
      tags: options.tags || []
    }
    const { nodeId, transactionId, object } = await this.nodeCreate<Folder>(state, { parentId: options.parentId }, options.arweaveTags);
    return { folderId: nodeId, transactionId, object };
  }
};

export {
  FolderService
}