import { Service } from './service';
import { functions, protocolTags, status } from "../constants";
import { NodeCreateOptions, NodeLike, NodeType } from '../types/node';
import { EncryptedKeys } from '@akord/crypto';
import { GetOptions, ListOptions } from '../types/query-options';
import { ContractInput, Tag, Tags } from '../types/contract';
import { Paginated } from '../types/paginated';
import { v4 as uuidv4 } from "uuid";
import { IncorrectEncryptionKey } from '../errors/incorrect-encryption-key';
import { BadRequest } from '../errors/bad-request';
import { handleListErrors, paginate } from './common';
import { Folder } from '../types/folder';
import { Stack } from '../types/stack';
import { Memo } from '../types/memo';
import { NFT } from '../types/nft';
import { Collection } from '../types/collection';

class NodeService<T> extends Service {
  objectType: NodeType;

  parentId?: string;

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
  public async list(vaultId: string, options: ListOptions = this.defaultListOptions = this.defaultListOptions): Promise<Paginated<T>> {
    const listOptions = {
      ...this.defaultListOptions,
      ...options
    }
    const response = await this.api.getNodesByVaultId<T>(vaultId, this.objectType, listOptions);
    const promises = response.items
      .map(async (nodeProto: any) => {
        return await this.processNode(nodeProto, !nodeProto.__public__ && listOptions.shouldDecrypt, nodeProto.__keys__);
      });
    const { items, errors } = await handleListErrors<T>(response.items, promises);
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
  public async listAll(vaultId: string, options: ListOptions = this.defaultListOptions): Promise<Array<T>> {
    const list = async (options: ListOptions & { vaultId: string }) => {
      return await this.list(options.vaultId, options);
    }
    return await paginate<T>(list, { ...options, vaultId });
  }

  /**
   * @param  {string} nodeId
   * @param  {string} name new name
   * @returns Promise with corresponding transaction id
   */
  public async rename(nodeId: string, name: string): Promise<{ transactionId: string, object: T }> {
    const service = new NodeService<T>(this.wallet, this.api);
    await service.setVaultContextFromNodeId(nodeId, this.objectType);
    service.setActionRef(this.objectType.toUpperCase() + "_RENAME");
    service.setFunction(functions.NODE_UPDATE);
    const state = {
      name: await service.processWriteString(name)
    };
    return service.nodeUpdate<T>(state);
  }

  /**
   * @param  {string} nodeId
   * @param  {string} [parentId] new parent folder id
   * @returns Promise with corresponding transaction id
   */
  public async move(nodeId: string, parentId?: string, vaultId?: string): Promise<{ transactionId: string, object: T }> {
    const service = new NodeService<T>(this.wallet, this.api);
    await service.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    service.setActionRef(this.objectType.toUpperCase() + "_MOVE");
    service.setFunction(functions.NODE_MOVE);
    return service.nodeUpdate<T>(null, { parentId });
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async revoke(nodeId: string, vaultId?: string): Promise<{ transactionId: string, object: T }> {
    const service = new NodeService<T>(this.wallet, this.api);
    await service.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    service.setActionRef(this.objectType.toUpperCase() + "_REVOKE");
    service.setFunction(functions.NODE_REVOKE);
    return service.nodeUpdate<T>();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async restore(nodeId: string, vaultId?: string): Promise<{ transactionId: string, object: T }> {
    const service = new NodeService<NodeLike>(this.wallet, this.api);
    await service.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    service.setActionRef(this.objectType.toUpperCase() + "_RESTORE");
    service.setFunction(functions.NODE_RESTORE);
    return service.nodeUpdate<T>();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async delete(nodeId: string, vaultId?: string): Promise<{ transactionId: string, object: T }> {
    const service = new NodeService<NodeLike>(this.wallet, this.api);
    await service.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    service.setActionRef(this.objectType.toUpperCase() + "_DELETE");
    service.setFunction(functions.NODE_DELETE);
    return service.nodeUpdate<T>();
  }

  protected async nodeCreate<T>(state?: any, clientInput?: { parentId?: string }, clientTags?: Tags): Promise<{
    nodeId: string,
    transactionId: string,
    object: T
  }> {
    const nodeId = uuidv4();
    this.setObjectId(nodeId);
    this.setFunction(functions.NODE_CREATE);
    this.setParentId(clientInput.parentId);

    this.arweaveTags = await this.getTxTags();
    clientTags?.map((tag: Tag) => this.arweaveTags.push(tag));

    const input = {
      function: this.function,
      ...clientInput
    } as ContractInput;

    if (state) {
      const id = await this.uploadState(state, this.vault.cloud);
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

    this.setParentId(clientInput?.parentId);
    this.arweaveTags = await this.getTxTags();

    if (stateUpdates) {
      const id = await this.mergeAndUploadState(stateUpdates, this.vault.cloud);
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

  async setParentId(parentId?: string) {
    this.parentId = parentId;
  }

  protected async setVaultContextFromNodeId(nodeId: string, type: NodeType, vaultId?: string) {
    const object = await this.api.getNode<NodeLike>(nodeId, type, vaultId);
    const vault = await this.api.getVault(object.vaultId);
    this.setVault(vault);
    this.setVaultId(object.vaultId);
    this.setIsPublic(object.__public__);
    await this.setMembershipKeys(object);
    this.setObject(object);
    this.setObjectId(nodeId);
    this.setObjectType(type);
  }

  async getTxTags(): Promise<Tags> {
    const tags = await super.getTxTags();
    tags.push(new Tag(protocolTags.NODE_ID, this.objectId))
    if (this.function === functions.NODE_CREATE || this.function === functions.NODE_MOVE) {
      tags.push(new Tag(protocolTags.PARENT_ID, this.parentId ? this.parentId : "root"));
    }
    return tags;
  }

  async processNode(object: NodeLike, shouldDecrypt: boolean, keys?: EncryptedKeys[]): Promise<T> {
    const node = this.nodeInstance(object, keys);
    if (shouldDecrypt) {
      try {
        await node.decrypt();
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
    return node as T;
  }

  protected NodeType: new (arg0: any, arg1: EncryptedKeys[]) => NodeLike

  private nodeInstance(nodeProto: any, keys: Array<EncryptedKeys>): NodeLike {
    // TODO: use a generic NodeLike constructor
    if (this.objectType === "Folder") {
      return new Folder(nodeProto, keys);
    } else if (this.objectType === "Stack") {
      return new Stack(nodeProto, keys);
    } else if (this.objectType === "Memo") {
      return new Memo(nodeProto, keys);
    } else if (this.objectType === "Collection") {
      return new Collection(nodeProto);
    } else if (this.objectType === "NFT") {
      return new NFT(nodeProto);
    } else {
      throw new BadRequest("Given type is not supported: " + this.objectType);
    }
  }
}

export {
  NodeService
}