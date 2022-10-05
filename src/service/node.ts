import { Service } from './service';
import { commands } from "../constants";

class NodeService extends Service {
  /**
   * @param  {string} nodeId
   * @param  {string} name new name
   * @returns Promise with corresponding transaction id
   */
  public async rename(nodeId: string, name: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType);
    this.setCommand(commands.NODE_UPDATE);
    const body = {
      name: await this.processWriteString(name)
    };
    return this.nodeUpdate(body);
  }

  /**
   * @param  {string} nodeId
   * @param  {string} [parentId] new parent folder id
   * @returns Promise with corresponding transaction id
   */
  public async move(nodeId: string, parentId?: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType);
    this.setCommand(commands.NODE_MOVE);
    return this.nodeUpdate(null, { parent: parentId });
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async revoke(nodeId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType);
    this.setCommand(commands.NODE_REVOKE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async restore(nodeId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType);
    this.setCommand(commands.NODE_RESTORE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async delete(nodeId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType);
    this.setCommand(commands.NODE_DELETE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with the decrypted node
   */
  public async get(nodeId: string): Promise<any> {
    const object = await this.api.getObject(nodeId, this.objectType);
    await this.setVaultContext(object.dataRoomId);
    object.state = await this.decryptState(object.state);
    delete object.__typename;
    return object;
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with all nodes within given vault
   */
  public async list(vaultId: string): Promise<any> {
    const nodes = await this.api.getObjectsByVaultId(vaultId, this.objectType);
    let nodeTable = [];
    await this.setVaultContext(vaultId);
    for (let node of nodes) {
      const decryptedState = await this.decryptState(node.state);
      nodeTable.push({
        id: node.id,
        createdAt: node.createdAt,
        ...decryptedState
      });
    }
    return nodeTable;
  }
}

export {
  NodeService
}