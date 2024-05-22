import { Service } from './service';
import { functions, protocolTags, status } from "../../constants";
import { NodeCreateOptions, NodeLike, NodeType } from '../../types/node';
import { Object } from "../../types/object";
import { EncryptedKeys, Encrypter } from '@akord/crypto';
import { GetOptions, ListOptions } from '../../types/query-options';
import { ContractInput, Tag, Tags } from '../../types/contract';
import { v4 as uuidv4 } from "uuid";
import { IncorrectEncryptionKey } from '../../errors/incorrect-encryption-key';
import { BadRequest } from '../../errors/bad-request';
import { Folder } from '../../types/folder';
import { Stack } from '../../types/stack';
import { Memo } from '../../types/memo';
import { NFT } from '../../types/nft';
import { Collection } from '../../types/collection';
import { Api } from '../../api/api';
import { Vault } from '../../types';
import { Signer } from '../../signer';

class NodeService<T> extends Service {
  objectType: NodeType;

  protected parentId?: string;

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

  protected defaultGetOptions = {
    shouldDecrypt: true,
  } as GetOptions;

  defaultCreateOptions = {
    parentId: undefined,
    tags: [],
    arweaveTags: [],
  } as NodeCreateOptions;

  constructor(config?: NodeServiceConfig) {
    super(config);
    this.objectType = config.objectType;
    this.NodeType = config.nodeType;
  }

  async nodeCreate<T>(state?: any, clientInput?: { parentId?: string }, clientTags?: Tags): Promise<{
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
      const id = await this.uploadState(state, this.isCloud());
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

  async nodeUpdate<T>(stateUpdates?: any, clientInput?: { parentId?: string }, metadata?: any): Promise<{ transactionId: string, object: T }> {
    const input = {
      function: this.function,
      ...clientInput
    } as ContractInput;

    this.setParentId(clientInput?.parentId);
    this.arweaveTags = await this.getTxTags();

    if (stateUpdates) {
      const id = await this.mergeAndUploadState(stateUpdates, this.isCloud());
      input.data = id;
    }
    const { id, object } = await this.api.postContractTransaction<T>(
      this.vaultId,
      input,
      this.arweaveTags,
      metadata
    );
    const node = await this.processNode(object as any, !this.isPublic, this.keys) as any;
    return { transactionId: id, object: node };
  }

  setParentId(parentId?: string) {
    this.parentId = parentId;
  }

  async setVaultContextFromNodeId(nodeId: string, type: NodeType, vaultId?: string) {
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

  NodeType: new (arg0: any, arg1: EncryptedKeys[]) => NodeLike

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

export type NodeServiceConfig = {
  api?: Api,
  signer?: Signer,
  encrypter?: Encrypter,
  keys?: Array<EncryptedKeys>
  vaultId?: string,
  objectId?: string,
  objectType?: NodeType,
  nodeType?: new (arg0: any, arg1: EncryptedKeys[]) => NodeLike,
  function?: functions,
  isPublic?: boolean,
  vault?: Vault,
  object?: Object,
  actionRef?: string,
  groupRef?: string,
  tags?: string[], // akord tags for easier search
  arweaveTags?: Tags // arweave tx tags,
  contentType?: string
}

export {
  NodeService
}