import { NodeService } from "./node";
import { actionRefs, functions } from "../constants";
import { Folder, nodeType } from "../types/node";

type FolderCreateResult = {
  folderId: string,
  transactionId: string,
  object: Folder
}

class FolderService extends NodeService<Folder> {
  objectType = nodeType.FOLDER;
  NodeType = Folder;

  /**
   * @param  {string} vaultId
   * @param  {string} name folder name
   * @param  {string} [parentId] parent folder id
   * @returns Promise with new folder id & corresponding transaction id
   */
  public async create(vaultId: string, name: string, parentId?: string): Promise<FolderCreateResult> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.FOLDER_CREATE);
    this.setFunction(functions.NODE_CREATE);
    const body = {
      name: await this.processWriteString(name)
    }
    const { nodeId, transactionId, object } = await this.nodeCreate<Folder>(body, { parentId });
    return { folderId: nodeId, transactionId, object };
  }
};

export {
  FolderService
}