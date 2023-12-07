import { NodeService } from "./node";
import { FileVersion, StackCreateOptions, StorageType, nodeType } from "../types";
import { FileSource } from "../types/file";
import { FileGetOptions, FileService, createFileLike } from "./file";
import { NFT, NFTMetadata } from "../types/nft";
import { Collection, CollectionMetadata } from "../types/collection";
import { actionRefs, functions, smartweaveTags } from "../constants";
import { Tag, Tags } from "../types/contract";
import { assetTags } from "../types/asset";
import { BadRequest } from "../errors/bad-request";
import { Paginated } from "../types/paginated";
import { ListOptions } from "../types/query-options";
import { mergeState, paginate } from "./common";
import { v4 as uuidv4 } from "uuid";
import { StackService } from "./stack";

const DEFAULT_TICKER = "ATOMIC";
const DEFAULT_CONTRACT_SRC = "Of9pi--Gj7hCTawhgxOwbuWnFI1h24TTgO5pw8ENJNQ"; // Atomic asset contract source

class NFTService extends NodeService<NFT> {
  objectType = nodeType.NFT;
  NodeType = NFT;

  /**
   * @param  {string} vaultId
   * @param  {FileSource} asset file source: web File object, file path, buffer or stream
   * @param  {NFTMetadata} metadata
   * @param  {StackCreateOptions} options
   * @returns Promise with corresponding transaction id
   */
  public async mint(
    vaultId: string,
    asset: FileSource,
    metadata: NFTMetadata,
    options: StackCreateOptions = this.defaultCreateOptions
  ): Promise<{ nftId: string, transactionId: string, object: NFT }> {

    const vault = await this.api.getVault(vaultId);
    if (!vault.public || vault.cacheOnly) {
      throw new BadRequest("NFT module applies only to public permanent vaults.");
    }

    const nftTags = nftMetadataToTags(metadata);

    const createOptions = {
      ...this.defaultCreateOptions,
      ...options
    }
    const service = new NFTService(this.wallet, this.api, this);
    service.setVault(vault);
    service.setVaultId(vaultId);
    service.setIsPublic(vault.public);
    service.setActionRef(actionRefs.NFT_MINT);
    service.setFunction(functions.NODE_CREATE);
    service.setAkordTags([]);

    createOptions.arweaveTags = (createOptions.arweaveTags || []).concat(nftTags);

    createOptions.cacheOnly = service.vault.cacheOnly;

    if (createOptions.ucm) {
      createOptions.arweaveTags = createOptions.arweaveTags.concat([{ name: 'Indexed-By', value: 'ucm' }]);
    }

    const fileLike = await createFileLike(asset, createOptions);
    if (fileLike.type) {
      createOptions.arweaveTags.push({ name: 'Content-Type', value: fileLike.type });
    }
    const fileService = new FileService(this.wallet, this.api, service);
    const fileUploadResult = await fileService.create(fileLike, createOptions);
    const version = await fileService.newVersion(fileLike, fileUploadResult);

    const state = JSON.parse(nftTags.find((tag: Tag) => tag.name === "Init-State").value);
    state.asset = version;

    const { nodeId, transactionId, object } = await service.nodeCreate<NFT>(state, { parentId: options.parentId });
    return { nftId: nodeId, transactionId, object };
  }

  /**
   * Get NFT asset
   * @param  {string} nftId
   * @returns Promise with NFT asset
   */
  public async getAsset(nftId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const nft = new NFT(await this.api.getNode<NFT>(nftId, this.objectType));
    const { fileData } = await this.api.downloadFile(nft.getUri(StorageType.S3), options);
    return { data: fileData, ...nft.asset } as FileVersion & { data: ArrayBuffer };
  }

  /**
   * Get NFT asset uri
   * @param  {string} nftId
   * @param  {StorageType} [type] storage type, default to arweave
   * @returns Promise with NFT asset uri
   */
  public async getUri(nftId: string, type: StorageType = StorageType.ARWEAVE): Promise<string> {
    const nft = new NFT(await this.api.getNode<NFT>(nftId, this.objectType));
    return nft.getUri(type);
  }

  /**
   * Mint a collection of Atomic NFTs, note that each NFT will inherit collection metadata setup
   * @param  {string} vaultId
   * @param  {{asset:FileSource,metadata:NFTMetadata,options:StackCreateOptions}[]} items
   * @param  {CollectionMetadata} metadata
   * @param  {StackCreateOptions} options
   * @returns Promise with corresponding transaction id
   */
  public async mintCollection(
    vaultId: string,
    items: { asset: FileSource, metadata?: NFTMetadata, options?: StackCreateOptions }[],
    metadata: CollectionMetadata,
    options: StackCreateOptions = this.defaultCreateOptions
  ): Promise<MintCollectionResponse> {

    const vault = await this.api.getVault(vaultId);
    if (!vault.public || vault.cacheOnly) {
      throw new BadRequest("NFT module applies only to public permanent vaults.");
    }

    const mintedItems = [] as string[];
    const nfts = [] as MintCollectionResponse["data"]["items"];
    const errors = [] as MintCollectionResponse["errors"];

    const service = new NFTService(this.wallet, this.api);
    service.setVault(vault);
    service.setVaultId(vaultId);
    service.setIsPublic(vault.public);
    service.setActionRef(actionRefs.NFT_MINT_COLLECTION);
    service.setFunction(functions.NODE_CREATE);
    service.setAkordTags([]);
    service.setObjectType("Collection");

    service.setGroupRef(uuidv4());

    const collectionState = {
      owner: metadata.owner,
      creator: metadata.creator,
      name: metadata.name,
      description: metadata.description,
      code: metadata.code,
      udl: options.udl,
      ucm: options.ucm,
    } as any;

    const { nodeId: collectionId } = await service.nodeCreate<Collection>(collectionState, { parentId: options.parentId });

    for (let nft of items) {
      try {
        const nftService = new NFTService(this.wallet, this.api, service);
        service.setObjectType("NFT");
        const { nftId, transactionId, object } = await nftService.mint(
          vaultId,
          nft.asset,
          { ...metadata, ...nft.metadata },
          { parentId: collectionId, ...options, ...nft.options }
        );
        mintedItems.push(object.getUri(StorageType.ARWEAVE));
        nfts.push({ nftId, transactionId, object });
      } catch (error) {
        errors.push({ name: nft.metadata.name, message: error.message, error: error });
      }
    }

    const collectionMintedState = {
      type: "Collection",
      items: mintedItems
    } as any;

    const collectionTags = [
      { name: 'Data-Protocol', value: "Collection" },
      { name: 'Content-Type', value: "application/json" },
      { name: smartweaveTags.APP_NAME, value: 'SmartWeaveContract' },
      { name: smartweaveTags.APP_VERSION, value: '0.3.0' },
      { name: smartweaveTags.CONTRACT_SOURCE, value: metadata.contractTxId || DEFAULT_CONTRACT_SRC },
      { name: smartweaveTags.INIT_STATE, value: JSON.stringify(collectionMintedState) },
      { name: assetTags.TITLE, value: metadata.name },
      { name: 'Name', value: metadata.name },
      { name: assetTags.DESCRIPTION, value: metadata.description },
      { name: assetTags.TYPE, value: "Document" },
      { name: 'Contract-Manifest', value: '{"evaluationOptions":{"sourceType":"redstone-sequencer","allowBigInt":true,"internalWrites":true,"unsafeClient":"skip","useConstructor":true}}' },
      { name: 'Vault-Id', value: vaultId },
    ];

    if (metadata.creator) {
      collectionTags.push({ name: 'Creator', value: metadata.creator });
    }

    if (metadata.code) {
      collectionTags.push({ name: 'Collection-Code', value: metadata.code });
    }

    if (metadata.banner) {
      const bannerService = new StackService(this.wallet, this.api, service);
      const { object: banner } = await bannerService.create(
        vaultId,
        metadata.banner,
        (<any>metadata.banner).name ? (<any>metadata.banner).name : "Collection banner",
        { parentId: collectionId }
      );
      collectionTags.push({ name: 'Banner', value: banner.getUri(StorageType.ARWEAVE) });
      collectionMintedState.bannerUri = banner.versions[0].resourceUri;
    } else {
      // if not provided, set the first NFT as a collection banner
      collectionTags.push({ name: 'Banner', value: nfts[0].object.asset.getUri(StorageType.ARWEAVE) });
      collectionMintedState.bannerUri = nfts[0].object.asset.resourceUri;
    }

    if (metadata.thumbnail) {
      const thumbnailService = new StackService(this.wallet, this.api, service);
      const { object: thumbnail } = await thumbnailService.create(
        vaultId,
        metadata.thumbnail,
        (<any>metadata.thumbnail).name ? (<any>metadata.thumbnail).name : "Collection thumbnail",
        { parentId: collectionId }
      );
      collectionTags.push({ name: 'Thumbnail', value: thumbnail.getUri(StorageType.ARWEAVE) });
      collectionMintedState.thumbnailUri = thumbnail.versions[0].resourceUri;
    }

    service.setObjectType("Collection");
    service.setObjectId(collectionId);
    service.setActionRef(actionRefs.NFT_MINT_COLLECTION);
    service.setFunction(functions.NODE_UPDATE);
    service.arweaveTags = await service.getTxTags();

    const mergedState = mergeState(collectionState, collectionMintedState);

    const ids = await service.api.uploadData([{ data: mergedState, tags: collectionTags }]);

    const { id, object } = await service.api.postContractTransaction<Collection>(
      service.vaultId,
      { function: service.function, data: ids[0] },
      service.arweaveTags
    );

    return {
      data: {
        items: nfts,
        collectionId: collectionId,
        transactionId: id,
        object: object
      },
      errors,
    }
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} options
   * @returns Promise with paginated collections within given vault
   */
  public async listCollections(vaultId: string, options: ListOptions = this.defaultListOptions): Promise<Paginated<Collection>> {
    const listOptions = {
      ...this.defaultListOptions,
      ...options
    }
    const response = await this.api.getNodesByVaultId<Collection>(vaultId, "Collection", listOptions);

    return {
      items: response.items,
      nextToken: response.nextToken,
      errors: []
    }
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} options
   * @returns Promise with all collections within given vault
   */
  public async listAllCollections(vaultId: string, options: ListOptions = this.defaultListOptions): Promise<Array<Collection>> {
    const list = async (options: ListOptions & { vaultId: string }) => {
      return await this.listCollections(options.vaultId, options);
    }
    return await paginate<Collection>(list, { ...options, vaultId });
  }
};

export const nftMetadataToTags = (metadata: NFTMetadata): Tags => {
  const initState = {
    ticker: metadata.ticker || DEFAULT_TICKER,
    name: metadata.name,
    description: metadata.description,
    creator: metadata.creator || metadata.owner,
    collection: metadata.collection,
    owner: metadata.owner,
    canEvolve: true,
    balances: {
      [metadata.owner]: 1,
    },
    claimable: []
  } as any;

  const nftTags = [
    { name: smartweaveTags.APP_NAME, value: 'SmartWeaveContract' },
    { name: smartweaveTags.APP_VERSION, value: '0.3.0' },
    { name: smartweaveTags.CONTRACT_SOURCE, value: metadata.contractTxId || DEFAULT_CONTRACT_SRC },
    { name: smartweaveTags.INIT_STATE, value: JSON.stringify(initState) },
    { name: assetTags.TITLE, value: metadata.name },
    { name: assetTags.TYPE, value: metadata.type },
    { name: 'Creator', value: metadata.creator },
    { name: 'Contract-Manifest', value: '{"evaluationOptions":{"sourceType":"redstone-sequencer","allowBigInt":true,"internalWrites":true,"unsafeClient":"skip","useConstructor":true}}' },
  ];

  if (metadata.description) {
    nftTags.push({ name: assetTags.DESCRIPTION, value: metadata.description });
  }
  if (metadata.collection) {
    nftTags.push({ name: 'Collection-Code', value: metadata.collection });
  }
  if (metadata.topics) {
    for (let topic of metadata.topics) {
      nftTags.push({ name: assetTags.TOPIC + ":" + topic, value: topic });
    }
  }
  return nftTags;
}

export interface MintCollectionResponse {
  data: {
    object: Collection,
    collectionId: string,
    transactionId: string,
    items: Array<{ nftId: string, transactionId: string, object: NFT }>
  }
  errors: Array<{ name?: string, message: string, error: Error }>
}

export {
  NFTService
}