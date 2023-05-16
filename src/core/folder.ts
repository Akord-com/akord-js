import { NodeCreateOptions, NodeService } from "./node";
import { actionRefs, functions } from "../constants";
import { Folder, nodeType } from "../types/node";

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
    this.setTags(options.tags);
    const body = {
      name: await this.processWriteString(name),
      tags: this.tags
    }
    const { nodeId, transactionId, object } = await this.nodeCreate<Folder>(body, { parentId: options.parentId });
    return { folderId: nodeId, transactionId, object };
  }
};

type FolderCreateResult = {
  folderId: string,
  transactionId: string,
  object: Folder
}

export {
  FolderService
}