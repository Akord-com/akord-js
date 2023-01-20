import { Service } from './service';
import { functions } from "../constants";
import { NodeLike } from '../types/node';
import { Keys } from '@akord/crypto';
import { defaultListOptions } from '../types/list-options';

class NodeService<T = NodeLike> extends Service {

  protected NodeType: new (arg0: any, arg1: Keys[]) => NodeLike

  /**
   * @param  {string} nodeId
   * @param  {string} name new name
   * @returns Promise with corresponding transaction id
   */
  public async rename(nodeId: string, name: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType);
    this.setFunction(functions.NODE_UPDATE);
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
  public async move(nodeId: string, parentId?: string, vaultId?: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType, vaultId);
    this.setFunction(functions.NODE_MOVE);
    return this.nodeUpdate(null, { parentId });
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async revoke(nodeId: string, vaultId?: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType, vaultId);
    this.setFunction(functions.NODE_REVOKE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async restore(nodeId: string, vaultId?: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType, vaultId);
    this.setFunction(functions.NODE_RESTORE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async delete(nodeId: string, vaultId?: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(nodeId, this.objectType, vaultId);
    this.setFunction(functions.NODE_DELETE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with the decrypted node
   */
  public async get(nodeId: string, vaultId?: string, shouldDecrypt = true): Promise<T> {
    const nodeProto = await this.api.getObject<any>(nodeId, this.objectType, vaultId);
    const { isEncrypted, keys } = await this.api.getMembershipKeys(nodeProto.vaultId, this.wallet)
    const node = this.nodeInstance(nodeProto, keys);
    if (isEncrypted && shouldDecrypt) {
      await node.decrypt();
    }
    return node as T;
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with all nodes within given vault
   */
  public async list(vaultId: string, listOptions = defaultListOptions): Promise<Array<T>> {
    const nodes = await this.api.getObjectsByVaultId<T>(vaultId, this.objectType, listOptions.shouldListAll);
    const { isEncrypted, keys } = await this.api.getMembershipKeys(vaultId, this.wallet);
    return await Promise.all(
      nodes
        .map(async nodeProto => {
          const node = this.nodeInstance(nodeProto, keys);
          if (isEncrypted && listOptions.shouldDecrypt) {
            await node.decrypt();
          }
          return node as T;
        }))
  }

  private nodeInstance(nodeProto: any, keys: Array<Keys>): NodeLike {
    return new this.NodeType(nodeProto, keys);
  }
}

export {
  NodeService
}