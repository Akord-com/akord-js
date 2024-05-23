import { Service } from './service/service';
import { functions, status } from "../constants";
import { NodeCreateOptions, NodeLike, NodeType } from '../types/node';
import { EncryptedKeys, Wallet } from '@akord/crypto';
import { GetOptions, ListOptions } from '../types/query-options';
import { Paginated } from '../types/paginated';
import { IncorrectEncryptionKey } from '../errors/incorrect-encryption-key';
import { BadRequest } from '../errors/bad-request';
import { handleListErrors, paginate } from './common';
import { Folder } from '../types/folder';
import { Stack } from '../types/stack';
import { Memo } from '../types/memo';
import { NFT } from '../types/nft';
import { Collection } from '../types/collection';
import { NodeService } from './service/node';
import { Api } from '../api/api';

class NodeModule<T> {
  protected objectType: NodeType;

  protected service: NodeService<T>;

  protected parentId?: string;

  protected defaultListOptions = {
    shouldDecrypt: true,
    parentId: undefined,
    filter: {
      status: { ne: status.REVOKED },
      and: {
        status: { ne: status.DELETED }
      }
    }
  } as ListOptions;

  protected defaultGetOptions = {
    shouldDecrypt: true,
  } as GetOptions;

  protected defaultCreateOptions = {
    parentId: undefined,
    tags: [],
    arweaveTags: [],
  } as NodeCreateOptions;

  constructor(wallet: Wallet, api: Api, nodeType: new (arg0: any, arg1: EncryptedKeys[]) => NodeLike, objectType: NodeType, service?: Service) {
    this.service = new NodeService<T>(wallet, api, nodeType, objectType, service);
    this.objectType = objectType;
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with the decrypted node
   */
  public async get(nodeId: string, options: GetOptions = this.defaultGetOptions): Promise<T> {
    const getOptions = {
      ...this.defaultGetOptions,
      ...options
    }
    const nodeProto = await this.service.api.getNode<NodeLike>(nodeId, this.objectType, getOptions.vaultId);
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
    const response = await this.service.api.getNodesByVaultId<T>(vaultId, this.objectType, listOptions);
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
    await this.service.setVaultContextFromNodeId(nodeId, this.objectType);
    this.service.setActionRef(this.objectType.toUpperCase() + "_RENAME");
    this.service.setFunction(functions.NODE_UPDATE);
    const state = {
      name: await this.service.processWriteString(name)
    };
    return this.service.nodeUpdate<T>(state);
  }

  /**
   * @param  {string} nodeId
   * @param  {string} [parentId] new parent folder id
   * @returns Promise with corresponding transaction id
   */
  public async move(nodeId: string, parentId?: string, vaultId?: string): Promise<{ transactionId: string, object: T }> {
    await this.service.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.service.setActionRef(this.objectType.toUpperCase() + "_MOVE");
    this.service.setFunction(functions.NODE_MOVE);
    return this.service.nodeUpdate<T>(null, { parentId });
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async revoke(nodeId: string, vaultId?: string): Promise<{ transactionId: string, object: T }> {
    await this.service.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.service.setActionRef(this.objectType.toUpperCase() + "_REVOKE");
    this.service.setFunction(functions.NODE_REVOKE);
    return this.service.nodeUpdate<T>();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async restore(nodeId: string, vaultId?: string): Promise<{ transactionId: string, object: T }> {
    await this.service.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.service.setActionRef(this.objectType.toUpperCase() + "_RESTORE");
    this.service.setFunction(functions.NODE_RESTORE);
    return this.service.nodeUpdate<T>();
  }

  /**
   * @param  {string} nodeId
   * @returns Promise with corresponding transaction id
   */
  public async delete(nodeId: string, vaultId?: string): Promise<{ transactionId: string, object: T }> {
    await this.service.setVaultContextFromNodeId(nodeId, this.objectType, vaultId);
    this.service.setActionRef(this.objectType.toUpperCase() + "_DELETE");
    this.service.setFunction(functions.NODE_DELETE);
    return this.service.nodeUpdate<T>();
  }

  private async processNode(object: NodeLike, shouldDecrypt: boolean, keys?: EncryptedKeys[]): Promise<T> {
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
  NodeModule
}