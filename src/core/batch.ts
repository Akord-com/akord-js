import { v4 as uuidv4 } from "uuid";
import PQueue, { AbortError } from "@esm2cjs/p-queue";
import { Service } from "../core";
import { MembershipService } from "./membership";
import { EMPTY_FILE_ERROR_MESSAGE, StackService } from "./stack";
import { NodeService } from "./node";
import { Node, NodeLike, NodeType } from "../types/node";
import { StackCreateOptions, Stack } from "../types/stack";
import { FileLike, FileSource } from "../types/file";
import { BatchMembershipInviteResponse, BatchNFTMintResponse, BatchStackCreateOptions, BatchStackCreateResponse } from "../types/batch";
import { Membership, RoleType, MembershipCreateOptions, activeStatus } from "../types/membership";
import { FileService, Hooks, createFileLike } from "./file";
import { actionRefs, functions, objectType, protocolTags } from "../constants";
import { ContractInput, Tag, Tags } from "../types/contract";
import { ObjectType } from "../types/object";
import { BadRequest } from "../errors/bad-request";
import { CollectionMintOptions, FileVersion, NFT, NFTMetadata, NFTMintOptions, StorageType, validateAssetMetadata } from "../types";
import lodash from "lodash";
import { NFTService, nftMetadataToTags, validateWallets } from "./nft";
import { NFTMintItem } from "./collection";


class BatchService extends Service {

  public static BATCH_CONCURRENCY = 50;
  parentId: string;

  /**
   * @param  {{id:string,type:NoteType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async revoke<T extends Node>(items: { id: string, type: NodeType }[])
    : Promise<{ transactionId: string, object: T }[]> {
    return this.batchUpdate<T>(items.map((item) => ({
      ...item,
      input: { function: functions.NODE_REVOKE },
      actionRef: item.type.toUpperCase() + "_REVOKE"
    })));
  }

  /**
   * @param  {{id:string,type:NoteType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async restore<T extends Node>(items: { id: string, type: NodeType }[])
    : Promise<{ transactionId: string, object: T }[]> {
    return this.batchUpdate<T>(items.map((item) => ({
      ...item,
      input: { function: functions.NODE_RESTORE },
      actionRef: item.type.toUpperCase() + "_RESTORE"
    })));
  }

  /**
   * @param  {{id:string,type:NodeType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async delete<T extends Node>(items: { id: string, type: NodeType }[])
    : Promise<{ transactionId: string, object: T }[]> {
    return this.batchUpdate<T>(items.map((item) => ({
      ...item,
      input: { function: functions.NODE_DELETE },
      actionRef: item.type.toUpperCase() + "_DELETE"
    })));
  }

  /**
   * @param  {{id:string,type:NodeType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async move<T extends Node>(items: { id: string, type: NodeType }[], parentId?: string)
    : Promise<{ transactionId: string, object: T }[]> {
    return this.batchUpdate<T>(items.map((item) => ({
      ...item,
      input: {
        function: functions.NODE_MOVE,
        parentId: parentId
      },
      actionRef: item.type.toUpperCase() + "_MOVE"
    })));
  }

  /**
   * @param  {{id:string,role:RoleType}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async membershipChangeRole(items: { id: string, role: RoleType }[])
    : Promise<{ transactionId: string, object: Membership }[]> {
    return this.batchUpdate<Membership>(items.map((item) => ({
      id: item.id,
      type: objectType.MEMBERSHIP,
      input: {
        function: functions.MEMBERSHIP_CHANGE_ROLE,
        role: item.role
      },
      actionRef: actionRefs.MEMBERSHIP_CHANGE_ROLE
    })));
  }

  /**
   * @param  {string} vaultId
   * @param  {{file:FileSource,options:StackCreateOptions}[]} items
   * @param  {BatchStackCreateOptions} [options]
   * @returns Promise with new stack ids & their corresponding transaction ids
   */
  public async stackCreate(
    vaultId: string,
    items: StackCreateItem[],
    options: BatchStackCreateOptions = {}
  ): Promise<BatchStackCreateResponse> {
    // prepare items to upload
    const stackUploadItems = await Promise.all(items.map(async (item: StackCreateItem) => {
      const fileLike = await createFileLike(item.file, item.options || {});
      return {
        file: fileLike,
        options: item.options
      }
    })) as StackUploadItem[];

    // set service context
    const vault = await this.api.getVault(vaultId);
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    await this.setMembershipKeys(vault);
    this.setGroupRef(items);
    this.setActionRef(actionRefs.STACK_CREATE);
    this.setFunction(functions.NODE_CREATE);

    const stackCreateOptions = {
      ...options,
      cloud: this.vault.cloud,
      storage: this.vault.cloud ? StorageType.S3 : StorageType.ARWEAVE,
    }

    const { errors, data, cancelled } = await this.upload(stackUploadItems, stackCreateOptions);
    return { data: data.map(item => ({ stackId: item.id, object: item.object as Stack, transactionId: item.transactionId, uri: item.uri })), errors, cancelled };
  }

  /**
   * @param  {string} vaultId
   * @param  {{asset:FileSource,metadata:NFTMetadata,options:NFTMintOptions}[]} items
   * @param  {BatchStackCreateOptions} [options]
   * @returns Promise with new stack ids & their corresponding transaction ids
   */
  public async nftMint(
    vaultId: string,
    items: NFTMintItem[],
    options: CollectionMintOptions = {}
  ): Promise<BatchNFTMintResponse> {
    const vault = await this.api.getVault(vaultId);
    if (!vault.public || vault.cloud) {
      throw new BadRequest("NFT module applies only to public permanent vaults.");
    }

    if (!items || items.length === 0) {
      throw new BadRequest("No items provided for minting.");
    }

    // validate items to mint
    const itemsToMint = await Promise.all(items.map(async (nft: NFTMintItem) => {
      validateAssetMetadata(nft.metadata);
      validateWallets(nft.metadata);
      const fileLike = await createFileLike(nft.asset);
      const nftTags = nftMetadataToTags(nft.metadata);
      const createOptions = {
        ...nft.options
      } as any;
      createOptions.arweaveTags = (options?.arweaveTags || []).concat(nftTags);

      if (options?.ucm) {
        createOptions.arweaveTags = createOptions.arweaveTags.concat([new Tag('Indexed-By', 'ucm')]);
      }
      if (fileLike.type) {
        createOptions.arweaveTags.push(new Tag('Content-Type', fileLike.type));
      }
      return { file: fileLike, metadata: nft.metadata, options: createOptions };
    })) as UploadItem[];

    if (!this.groupRef) {
      this.setGroupRef(items);
    }

    // set service context
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    this.setActionRef(actionRefs.NFT_MINT);
    this.setFunction(functions.NODE_CREATE);
    this.setAkordTags([]);

    const { errors, data, cancelled } = await this.upload(itemsToMint, options);
    return { data: data.map(item => ({ nftId: item.id, object: item.object as NFT, transactionId: item.transactionId, uri: item.uri })), errors, cancelled };
  }

  /**
   * @param  {{file:FileLike,options:StackCreateOptions}[]} items
   * @param  {BatchUploadOptions} [options]
   * @returns Promise with item ids & their corresponding transaction ids
   */
  public async upload(
    items: UploadItem[],
    options: BatchUploadOptions = {}
  ): Promise<BatchUploadResponse> {
    const data = [] as BatchUploadResponse["data"];
    const errors = [] as BatchUploadResponse["errors"];

    const [itemsToUpload, emptyFileItems] = lodash.partition(items, function (item: UploadItem) { return item.file?.size > 0 });

    emptyFileItems.map((item: UploadItem) => {
      errors.push({ name: item.file?.name, message: EMPTY_FILE_ERROR_MESSAGE, error: new BadRequest(EMPTY_FILE_ERROR_MESSAGE) });
    })

    const batchSize = itemsToUpload.reduce((sum, item) => {
      return sum + item.file.size;
    }, 0);
    batchProgressCount(batchSize, options);

    let itemsCreated = 0;
    const uploadQ = new PQueue({ concurrency: BatchService.BATCH_CONCURRENCY });
    const postTxQ = new PQueue({ concurrency: BatchService.BATCH_CONCURRENCY });

    const uploadItem = async (item: UploadItem) => {
      let service: StackService | NFTService;
      if (item.metadata) {
        service = new NFTService(this.wallet, this.api, this)
      } else {
        service = new StackService(this.wallet, this.api, this);
      }

      const nodeId = uuidv4();
      service.setObjectId(nodeId);

      const createOptions = {
        ...options,
        ...(item.options || {})
      } as StackCreateOptions;

      if (service instanceof StackService) {
        service.setAkordTags((service.isPublic ? [item.file.name] : []).concat(createOptions.tags));
        service.setParentId(createOptions.parentId);
        service.arweaveTags = await service.getTxTags();
      } else {
        service.arweaveTags = createOptions.arweaveTags;
      }

      const fileService = new FileService(this.wallet, this.api, service);
      try {
        const fileUploadResult = await fileService.create(item.file, createOptions);
        const version = await fileService.newVersion(item.file, fileUploadResult);

        if (service instanceof StackService) {
          postTxQ.add(() => postStackTx(service as StackService, item, version, options), { signal: options.cancelHook?.signal })
        } else {
          postTxQ.add(() => postMintTx(service as NFTService, item, version, options), { signal: options.cancelHook?.signal })
        }
      } catch (error) {
        if (!(error instanceof AbortError) && !options.cancelHook?.signal?.aborted) {
          errors.push({ name: item.file.name, message: error.toString(), error });
        }
      }
    }

    const postStackTx = async (service: StackService, item: StackUploadItem, version: any, options: BatchUploadOptions) => {
      try {
        const state = {
          name: await service.processWriteString(item.file.name),
          versions: [version],
          tags: service.tags
        };
        const dataTx = await service.uploadState(state, service.vault.cloud);
        const input = {
          function: service.function,
          data: dataTx,
          parentId: item.options?.parentId
        };
        const { id, object } = await service.api.postContractTransaction<Stack>(
          service.vaultId,
          input,
          service.arweaveTags
        );
        const stack = await new StackService(service.wallet,service.api, service)
          .processNode(object, !service.isPublic, service.keys);
        if (options.onStackCreated) {
          await options.onStackCreated(stack);
        }
        data.push({ transactionId: id, object: stack, id: object.id, uri: object.uri });
        itemsCreated += 1;
      } catch (error) {
        errors.push({ name: item.file.name, message: error.toString(), error });
      };
    }

    const postMintTx = async (service: NFTService, item: UploadItem, version: FileVersion, options: BatchUploadOptions) => {
      try {
        const state = JSON.parse(service.arweaveTags.find((tag: Tag) => tag.name === "Init-State").value);
        state.asset = version;
        const { transactionId, object } = await service.nodeCreate<NFT>(state, { parentId: item.options?.parentId });

        if (options.onItemCreated) {
          await options.onItemCreated(object);
        }
        data.push({ transactionId: transactionId, object: object, id: object.id, uri: object.uri });
        itemsCreated += 1;
      } catch (error) {
        errors.push({ name: item.file.name, message: error.toString(), error });
      };
    }

    try {
      await uploadQ.addAll(itemsToUpload.map(item => () => uploadItem(item)), { signal: options.cancelHook?.signal });
    } catch (error) {
      if (!(error instanceof AbortError) && !options.cancelHook?.signal?.aborted) {
        errors.push({ message: error.toString(), error });
      }
    }
    await postTxQ.onIdle();
    if (options.cancelHook?.signal?.aborted) {
      return ({ data, errors, cancelled: items.length - itemsCreated });
    }
    return { data, errors, cancelled: 0 };
  }

  /**
   * @param  {string} vaultId
   * @param  {{email:string,role:RoleType}[]} items
   * @param  {MembershipCreateOptions} [options] invitation email message, etc.
   * @returns Promise with new membership ids & their corresponding transaction ids
   */
  public async membershipInvite(vaultId: string, items: MembershipInviteItem[], options: MembershipCreateOptions = {})
    : Promise<BatchMembershipInviteResponse> {
    const members = await this.api.getMembers(vaultId);
    const data = [] as BatchMembershipInviteResponse["data"];
    const errors = [];

    const transactions = [] as MembershipInviteTransaction[];

    // set service context
    this.setGroupRef(items);
    const vault = await this.api.getVault(vaultId);
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    await this.setMembershipKeys(vault);
    this.setActionRef(actionRefs.MEMBERSHIP_INVITE);
    this.setFunction(functions.MEMBERSHIP_INVITE);

    // upload metadata
    await Promise.all(items.map(async (item: MembershipInviteItem) => {
      const email = item.email.toLowerCase();
      const role = item.role;
      const member = members.find(item => item.email?.toLowerCase() === email);
      if (member && activeStatus.includes(member.status)) {
        const message = "Membership already exists for this user.";
        errors.push({ email: email, message, error: new BadRequest(message) });
      } else {
        const userHasAccount = await this.api.existsUser(email);
        const service = new MembershipService(this.wallet, this.api, this);
        if (userHasAccount) {
          const membershipId = uuidv4();
          service.setObjectId(membershipId);

          const { address, publicKey, publicSigningKey } = await this.api.getUserPublicData(email);
          const state = {
            keys: await service.prepareMemberKeys(publicKey),
            encPublicSigningKey: await service.processWriteString(publicSigningKey)
          };

          service.arweaveTags = [new Tag(protocolTags.MEMBER_ADDRESS, address)]
            .concat(await service.getTxTags());

          const dataTxId = await service.uploadState(state, service.vault.cloud);

          transactions.push({
            vaultId,
            input: { function: service.function, address, role, data: dataTxId },
            tags: service.arweaveTags,
            item: item
          });
        } else {
          try {
            const { id } = await this.api.inviteNewUser(vaultId, email, role, options.message);
            data.push({
              membershipId: id,
              transactionId: null
            })
          } catch (error: any) {
            errors.push({
              email: email,
              error: error,
              message: error.message,
              item: item
            })
          }
        }
      }
    }
    ));

    for (let tx of transactions) {
      try {
        const { id, object } = await this.api.postContractTransaction<Membership>(vaultId, tx.input, tx.tags, { message: options.message });
        data.push({ membershipId: object.id, transactionId: id, object: new Membership(object) });
      } catch (error: any) {
        errors.push({
          email: tx.item.email,
          error: error,
          message: error.message,
          item: tx.item
        })
      }
    }
    return { data: data, errors: errors };
  }

  private async batchUpdate<T>(items: { id: string, type: ObjectType, input: ContractInput, actionRef: string }[])
    : Promise<{ transactionId: string, object: T }[]> {
    this.setGroupRef(items);
    const result = [] as { transactionId: string, object: T }[];
    for (const [itemIndex, item] of items.entries()) {
      const node = item.type === objectType.MEMBERSHIP
        ? await this.api.getMembership(item.id)
        : await this.api.getNode<NodeLike>(item.id, item.type);

      if (itemIndex === 0 || this.vaultId !== node.vaultId) {
        this.setVaultId(node.vaultId);
        this.setIsPublic(node.__public__);
        await this.setMembershipKeys(node);
      }
      const service = item.type === objectType.MEMBERSHIP
        ? new MembershipService(this.wallet, this.api, this)
        : new NodeService<T>(this.wallet, this.api, this);

      service.setFunction(item.input.function);
      service.setActionRef(item.actionRef);
      service.setObject(node);
      service.setObjectId(item.id);
      service.setObjectType(item.type);
      service.arweaveTags = await service.getTxTags();
      const { id, object } = await this.api.postContractTransaction<T>(service.vaultId, item.input, service.arweaveTags);
      const processedObject = item.type === objectType.MEMBERSHIP
        ? new Membership(object)
        : await (<NodeService<T>>service).processNode(object as any, !this.isPublic, this.keys) as any;
      result.push({ transactionId: id, object: processedObject });
    }
    return result;
  }

  public setGroupRef(items: any) {
    this.groupRef = items && items.length > 1 ? uuidv4() : null;
  }

  setParentId(parentId?: string) {
    this.parentId = parentId;
  }
}

export const batchProgressCount = (batchSize: number, options: BatchStackCreateOptions) => {
  let progress = 0;
  let uploadedItemsCount = 0;
  if (options.processingCountHook) {
    options.processingCountHook(uploadedItemsCount);
  }
  const perFileProgress = new Map();
  const uploadedFiles = new Set();
  if (options.progressHook) {
    const onProgress = options.progressHook
    const itemProgressHook = (percentageProgress: number, binaryProgress: number, progressId: string) => {
      progress += binaryProgress - (perFileProgress.get(progressId) || 0)
      perFileProgress.set(progressId, binaryProgress);
      onProgress(Math.min(100, Math.round(progress / batchSize * 100)));
      if (percentageProgress === 100 && !uploadedFiles.has(progressId)) {
        uploadedFiles.add(progressId);
        uploadedItemsCount += 1;
        if (options.processingCountHook) {
          options.processingCountHook(uploadedItemsCount);
        }
      }
    }
    options.progressHook = itemProgressHook;
  }
}

export type StackUploadItem = {
  file: FileLike,
  options?: StackCreateOptions
}

export type ItemToMint = {
  asset: FileLike,
  metadata: NFTMetadata,
  options?: NFTMintOptions
}

export type TransactionPayload = {
  vaultId: string,
  input: ContractInput,
  tags: Tags
}

export type StackCreateTransaction = TransactionPayload & {
  item: StackCreateItem
}

export type MembershipInviteTransaction = TransactionPayload & {
  item: MembershipInviteItem
}

export type StackCreateItem = {
  file: FileSource,
  options?: StackCreateOptions
}

export type UploadItem = {
  file: FileLike,
  options?: StackCreateOptions | NFTMintOptions,
  metadata?: NFTMetadata,
}

export type BatchUploadOptions = Hooks & {
  processingCountHook?: (count: number) => void,
  onItemCreated?: (item: NFT) => Promise<void>
  onStackCreated?: (item: Stack) => Promise<void>
};

export interface BatchUploadResponse {
  data: Array<{ id: string, transactionId: string, object: Stack | NFT, uri: string }>
  errors: Array<{ name?: string, message: string, error: Error }>
  cancelled: number
}

export type MembershipInviteItem = {
  email: string,
  role: RoleType
}

export {
  BatchService
}
