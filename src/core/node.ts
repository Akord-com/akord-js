import { Service } from './service';
import { functions, protocolTags, status } from "../constants";
import { NodeLike, NodeType } from '../types/node';
import { EncryptedKeys } from '@akord/crypto';
import { ListOptions } from '../types/list-options';
import { Tag, Tags } from '../types/contract';
import { Paginated } from '../types/paginated';
import { v4 as uuidv4 } from "uuid";

class NodeService<T = NodeLike> extends Service {

  protected NodeType: new (arg0: any, arg1: EncryptedKeys[]) => NodeLike
  objectType: NodeType;

  defaultListOptions = {
    shouldDecrypt: true,
    filter: {
      status: { ne: status.REVOKED },
      and: {
        status: { ne: status.DELETED }
      }
    }
  } as ListOptions;

  protected async nodeCreate<T>(body?: any, clientInput?: any): Promise<{
    nodeId: string,
    transactionId: string,
    object: T
  }> {
    const nodeId = uuidv4();
    this.setObjectId(nodeId);
    this.setFunction(functions.NODE_CREATE);

    this.tags = await this.getTags();

    const input = {
      function: this.function,
      ...clientInput
    };

    if (body) {
      const id = await this.uploadState(body);
      input.data = id;
    }

    const { id, object } = await this.api.postContractTransaction<T>(
      this.vaultId,
      input,
      this.tags
    );
    const node = this.nodeInstance(object, this.keys) as any;
    if (!this.isPublic) {
      await node.decrypt();
    }
    return { nodeId, transactionId: id, object: node };
  }

  /**
   * @param  {string} nodeId
   * @param  {string} name new name
   * @returns Promise with corresponding transaction id
   */
  public async rename(nodeId: string, name: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromNodeId(nodeId, this.objectType);
    this.setActionRef(this.objectType.toUpperCase() + "_RENAME");
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
    await this.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.setActionRef(this.objectType.toUpperCase() + "_MOVE");
    this.setFunction(functions.NODE_MOVE);
    return this.nodeUpdate(null, { parentId });
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async revoke(nodeId: string, vaultId?: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.setActionRef(this.objectType.toUpperCase() + "_REVOKE");
    this.setFunction(functions.NODE_REVOKE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async restore(nodeId: string, vaultId?: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.setActionRef(this.objectType.toUpperCase() + "_RESTORE");
    this.setFunction(functions.NODE_RESTORE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async delete(nodeId: string, vaultId?: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.setActionRef(this.objectType.toUpperCase() + "_DELETE");
    this.setFunction(functions.NODE_DELETE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with the decrypted node
   */
  public async get(nodeId: string, vaultId?: string, shouldDecrypt = true): Promise<T> {
    const nodeProto = await this.api.getNode<NodeLike>(nodeId, this.objectType, vaultId);
    const { isEncrypted, keys } = await this.api.getMembershipKeys(nodeProto.vaultId);
    const node = this.nodeInstance(nodeProto, keys);
    if (isEncrypted && shouldDecrypt) {
      await node.decrypt();
    }
    return node as T;
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} listOptions
   * @returns Promise with paginated nodes within given vault
   */
  public async list(vaultId: string, parentId?: string, listOptions: ListOptions = this.defaultListOptions = this.defaultListOptions): Promise<Paginated<NodeLike>> {
    const response = await this.api.getNodesByVaultId<NodeLike>(vaultId, this.objectType, parentId, listOptions.filter, listOptions.limit, listOptions.nextToken);
    const { isEncrypted, keys } = listOptions.shouldDecrypt ? await this.api.getMembershipKeys(vaultId) : { isEncrypted: false, keys: [] };
    return {
      items: await Promise.all(
        response.items
          .map(async nodeProto => {
            const node = this.nodeInstance(nodeProto, keys);
            if (isEncrypted) {
              await node.decrypt();
            }
            return node as NodeLike;
          })) as NodeLike[],
      nextToken: response.nextToken
    }
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} listOptions
   * @returns Promise with all nodes within given vault
   */
  public async listAll(vaultId: string, parentId?: string, listOptions: ListOptions = this.defaultListOptions): Promise<Array<NodeLike>> {
    let token = null;
    let nodeArray = [] as NodeLike[];
    do {
      const { items, nextToken } = await this.list(vaultId, parentId, listOptions);
      nodeArray = nodeArray.concat(items);
      token = nextToken;
      listOptions.nextToken = nextToken;
      if (nextToken === "null") {
        token = null;
      }
    } while (token);
    return nodeArray;
  }

  private nodeInstance(nodeProto: any, keys: Array<EncryptedKeys>): NodeLike {
    return new this.NodeType(nodeProto, keys);
  }

  protected async setVaultContextFromNodeId(nodeId: string, type: NodeType, vaultId?: string) {
    const object = await this.api.getNode<NodeLike>(nodeId, type, this.vaultId);
    await this.setVaultContext(vaultId || object.vaultId);
    this.setObject(object);
    this.setObjectId(nodeId);
    this.setObjectType(type);
  }

  protected async getTags(): Promise<Tags> {
    const tags = await super.getTags();
    return tags.concat(new Tag(protocolTags.NODE_ID, this.objectId));
  }
}

export {
  NodeService
}