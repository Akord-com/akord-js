import { Service } from './service';
import { functions, protocolTags, status } from "../constants";
import { NodeLike, NodeType } from '../types/node';
import { EncryptedKeys } from '@akord/crypto';
import { GetOptions, ListOptions } from '../types/query-options';
import { ContractInput, Tag, Tags } from '../types/contract';
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

  defaultCreateOptions = {
    parentId: undefined,
    tags: [],
    arweaveTags: [],
  } as NodeCreateOptions;

  /**
   * @param  {string} nodeId
   * @returns Promise with the decrypted node
   */
  public async get(nodeId: string, options: GetOptions = this.defaultGetOptions): Promise<T> {
    const getOptions = {
      ...this.defaultGetOptions,
      ...options
    }
    const nodeProto = await this.api.getNode<NodeLike>(nodeId, this.objectType, getOptions.vaultId);
    const node = await this.processNode(nodeProto, !nodeProto.__public__ && getOptions.shouldDecrypt, nodeProto.__keys__);
    return node as T;
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} options
   * @returns Promise with paginated nodes within given vault
   */
  public async list(vaultId: string, options: ListOptions = this.defaultListOptions = this.defaultListOptions): Promise<Paginated<NodeLike>> {
    const listOptions = {
      ...this.defaultListOptions,
      ...options
    }
    const response = await this.api.getNodesByVaultId<NodeLike>(vaultId, this.objectType, listOptions);
    const promises = response.items
      .map(async nodeProto => {
        return await this.processNode(nodeProto, !nodeProto.__public__ && listOptions.shouldDecrypt, nodeProto.__keys__);
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
    const list = async (options: ListOptions & { vaultId: string }) => {
      return await this.list(options.vaultId, options);
    }
    return await this.paginate<NodeLike>(list, { ...options, vaultId });
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
    const state = {
      name: await this.processWriteString(name)
    };
    return this.nodeUpdate<NodeLike>(state);
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

  protected async nodeCreate<T>(state?: any, clientInput?: { parentId?: string }, clientTags?: Tags): Promise<{
    nodeId: string,
    transactionId: string,
    object: T
  }> {
    const nodeId = uuidv4();
    this.setObjectId(nodeId);
    this.setFunction(functions.NODE_CREATE);

    this.arweaveTags = await this.getTxTags();
    clientTags?.map((tag: Tag) => this.arweaveTags.push(tag));
    this.arweaveTags.push(new Tag(protocolTags.PARENT_ID, clientInput.parentId ? clientInput.parentId : "root"));

    const input = {
      function: this.function,
      ...clientInput
    } as ContractInput;

    if (state) {
      const id = await this.uploadState(state);
      input.data = id;
    }

    const { id, object } = await this.api.postContractTransaction<T>(
      this.vaultId,
      input,
      this.arweaveTags
    );
    const node = await this.processNode(object as any, !this.isPublic, this.keys) as any;
    return { nodeId, transactionId: id, object: node };
  }

  protected async nodeUpdate<T>(stateUpdates?: any, clientInput?: { parentId?: string }): Promise<{ transactionId: string, object: T }> {
    const input = {
      function: this.function,
      ...clientInput
    } as ContractInput;

    this.arweaveTags = await this.getTxTags();
    if (clientInput && this.function === functions.NODE_MOVE) {
      this.arweaveTags.push(new Tag(protocolTags.PARENT_ID, clientInput.parentId ? clientInput.parentId : "root"));
    }

    if (stateUpdates) {
      const id = await this.mergeAndUploadState(stateUpdates);
      input.data = id;
    }
    const { id, object } = await this.api.postContractTransaction<T>(
      this.vaultId,
      input,
      this.arweaveTags
    );
    const node = await this.processNode(object as any, !this.isPublic, this.keys) as any;
    return { transactionId: id, object: node };
  }

  protected async setVaultContextFromNodeId(nodeId: string, type: NodeType, vaultId?: string) {
    const object = await this.api.getNode<NodeLike>(nodeId, type, vaultId);
    this.setVaultId(object.vaultId);
    this.setIsPublic(object.__public__);
    await this.setMembershipKeys(object);
    this.setObject(object);
    this.setObjectId(nodeId);
    this.setObjectType(type);
  }

  protected async getTxTags(): Promise<Tags> {
    const tags = await super.getTxTags();
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

export type NodeCreateOptions = {
  parentId?: string,
  tags?: string[],
  arweaveTags?: Tags
}

export {
  NodeService
}