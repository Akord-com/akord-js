import { NodeService } from "./node";
import { actionRefs, commands, objectTypes } from "../constants";

class FolderService extends NodeService {
  objectType: string = objectTypes.FOLDER;

  /**
   * @param  {string} vaultId
   * @param  {string} name folder name
   * @param  {string} [parentId] parent folder id
   * @returns Promise with new folder id & corresponding transaction id
   */
  public async create(vaultId: string, name: string, parentId?: string): Promise<{
    folderId: string,
    transactionId: string
  }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.FOLDER_CREATE);
    this.setCommand(commands.NODE_CREATE);
    const body = {
      name: await this.processWriteString(name)
    }
    const { nodeId, transactionId } = await this.nodeCreate(body, {
      parent: parentId
    });
    return { folderId: nodeId, transactionId };
  }
};

export {
  FolderService
}