import { Service } from './service';
import { functions, protocolTags, status } from "../constants";
import { NodeLike, NodeType } from '../types/node';
import { EncryptedKeys } from '@akord/crypto';
import { GetOptions, ListOptions } from '../types/query-options';
import { Tag, Tags } from '../types/contract';
import { Paginated } from '../types/paginated';
import { v4 as uuidv4 } from "uuid";
import { IncorrectEncryptionKey } from '../errors/incorrect-encryption-key';

class NodeService<T = NodeLike> extends Service {
  objectType: NodeType;

  defaultListOptions = {
    shouldDecrypt: true,
    parentId: undefined,
    filter: {
      status: { ne: status.REVOKED },
      and: {
        status: { ne: status.DELETED }
      }
    }
  } as ListOptions;

  defaultGetOptions = {
    shouldDecrypt: true,
  } as GetOptions;

  /**
   * @param  {string} nodeId
   * @returns Promise with the decrypted node
   */
  public async get(nodeId: string, options: GetOptions = this.defaultGetOptions): Promise<T> {
    const nodeProto = await this.api.getNode<NodeLike>(nodeId, this.objectType, options.vaultId);
    const { isEncrypted, keys } = await this.api.getMembershipKeys(nodeProto.vaultId);
    const node = await this.processNode(nodeProto, isEncrypted && options.shouldDecrypt, keys);
    return node as T;
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} options
   * @returns Promise with paginated nodes within given vault
   */
  public async list(vaultId: string, options: ListOptions = this.defaultListOptions = this.defaultListOptions): Promise<Paginated<NodeLike>> {
    const response = await this.api.getNodesByVaultId<NodeLike>(vaultId, this.objectType, options.parentId, options.filter, options.limit, options.nextToken);
    const { isEncrypted, keys } = options.shouldDecrypt ? await this.api.getMembershipKeys(vaultId) : { isEncrypted: false, keys: [] };
    const promises = response.items
      .map(async nodeProto => {
        return await this.processNode(nodeProto, isEncrypted && options.shouldDecrypt, keys);
      }) as Promise<NodeLike>[];
    const { items, errors } = await this.handleListErrors<NodeLike>(response.items, promises);
    return {
      items,
      nextToken: response.nextToken,
      errors
    }
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} options
   * @returns Promise with all nodes within given vault
   */
  public async listAll(vaultId: string, options: ListOptions = this.defaultListOptions): Promise<Array<NodeLike>> {
    let token = null;
    let nodeArray = [] as NodeLike[];
    do {
      const { items, nextToken } = await this.list(vaultId, options);
      nodeArray = nodeArray.concat(items);
      token = nextToken;
      options.nextToken = nextToken;
      if (nextToken === "null") {
        token = null;
      }
    } while (token);
    return nodeArray;
  }

  /**
   * @param  {string} nodeId
   * @param  {string} name new name
   * @returns Promise with corresponding transaction id
   */
  public async rename(nodeId: string, name: string): Promise<NodeUpdateResult> {
    await this.setVaultContextFromNodeId(nodeId, this.objectType);
    this.setActionRef(this.objectType.toUpperCase() + "_RENAME");
    this.setFunction(functions.NODE_UPDATE);
    const body = {
      name: await this.processWriteString(name)
    };
    return this.nodeUpdate<NodeLike>(body);
  }

  /**
   * @param  {string} nodeId
   * @param  {string} [parentId] new parent folder id
   * @returns Promise with corresponding transaction id
   */
  public async move(nodeId: string, parentId?: string, vaultId?: string): Promise<NodeUpdateResult> {
    await this.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.setActionRef(this.objectType.toUpperCase() + "_MOVE");
    this.setFunction(functions.NODE_MOVE);
    return this.nodeUpdate<NodeLike>(null, { parentId });
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async revoke(nodeId: string, vaultId?: string): Promise<NodeUpdateResult> {
    await this.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.setActionRef(this.objectType.toUpperCase() + "_REVOKE");
    this.setFunction(functions.NODE_REVOKE);
    return this.nodeUpdate<NodeLike>();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async restore(nodeId: string, vaultId?: string): Promise<NodeUpdateResult> {
    await this.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.setActionRef(this.objectType.toUpperCase() + "_RESTORE");
    this.setFunction(functions.NODE_RESTORE);
    return this.nodeUpdate<NodeLike>();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async delete(nodeId: string, vaultId?: string): Promise<NodeUpdateResult> {
    await this.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.setActionRef(this.objectType.toUpperCase() + "_DELETE");
    this.setFunction(functions.NODE_DELETE);
    return this.nodeUpdate<NodeLike>();
  }

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
    const node = await this.processNode(object as any, !this.isPublic, this.keys) as any;
    return { nodeId, transactionId: id, object: node };
  }

  protected async nodeUpdate<T>(body?: any, clientInput?: any): Promise<{ transactionId: string, object: T }> {
    const input = {
      function: this.function,
      ...clientInput
    };

    this.tags = await this.getTags();

    if (body) {
      const id = await this.mergeAndUploadBody(body);
      input.data = id;
    }
    const { id, object } = await this.api.postContractTransaction<T>(
      this.vaultId,
      input,
      this.tags
    );
    const node = await this.processNode(object as any, !this.isPublic, this.keys) as any;
    return { transactionId: id, object: node };
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

  protected async processNode(object: NodeLike, shouldDecrypt: boolean, keys?: EncryptedKeys[]): Promise<NodeLike> {
    const node = this.nodeInstance(object, keys);
    if (shouldDecrypt) {
      try {
        await node.decrypt();
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
    return node;
  }

  protected NodeType: new (arg0: any, arg1: EncryptedKeys[]) => NodeLike

  private nodeInstance(nodeProto: any, keys: Array<EncryptedKeys>): NodeLike {
    return new this.NodeType(nodeProto, keys);
  }
}

type NodeUpdateResult = {
  transactionId: string,
  object: NodeLike
}

export {
  NodeService
}