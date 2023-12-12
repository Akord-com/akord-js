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
import { Logger } from "../logger";

const DEFAULT_TICKER = "ATOMIC";
const DEFAULT_TYPE = "image";
const DEFAULT_CONTRACT_SRC = "Of9pi--Gj7hCTawhgxOwbuWnFI1h24TTgO5pw8ENJNQ"; // Atomic asset contract source
const WARP_MANIFEST = '{"evaluationOptions":{"sourceType":"redstone-sequencer","allowBigInt":true,"internalWrites":true,"unsafeClient":"skip","useConstructor":true}}';

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
      createOptions.arweaveTags = createOptions.arweaveTags.concat([new Tag('Indexed-By', 'ucm')]);
    }

    const fileLike = await createFileLike(asset, createOptions);
    if (fileLike.type) {
      createOptions.arweaveTags.push(new Tag('Content-Type', fileLike.type));
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

    if (!items || items.length === 0) {
      throw new BadRequest("No items provided for minting.");
    }

    if (!metadata.name) {
      throw new BadRequest("Missing collection name.");
    }

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
        Logger.log("Minting the atomic asset failed.");
        Logger.log(error);
        errors.push({ name: nft.metadata.name, message: error.message, error: error });
      }
    }

    if (mintedItems.length === 0) {
      return {
        data: { items: [], collectionId: undefined, transactionId: undefined, object: undefined },
        errors,
      }
    }

    const collectionMintedState = {
      type: "Collection",
      items: mintedItems
    } as any;

    const collectionTags = [
      new Tag('Data-Protocol', "Collection"),
      new Tag('Content-Type', "application/json"),
      new Tag(smartweaveTags.APP_NAME, 'SmartWeaveContract'),
      new Tag(smartweaveTags.APP_VERSION, '0.3.0'),
      new Tag(smartweaveTags.CONTRACT_SOURCE, metadata.contractTxId || DEFAULT_CONTRACT_SRC),
      new Tag(smartweaveTags.INIT_STATE, JSON.stringify(collectionMintedState)),
      new Tag(assetTags.TITLE, metadata.name),
      new Tag('Name', metadata.name),
      new Tag(assetTags.TYPE, "Document"),
      new Tag('Contract-Manifest', WARP_MANIFEST),
      new Tag('Vault-Id', vaultId),
    ];

    if (metadata.description) {
      collectionTags.push(new Tag(assetTags.DESCRIPTION, metadata.description));
    }

    if (metadata.creator) {
      collectionTags.push(new Tag('Creator', metadata.creator));
    }

    if (metadata.code) {
      collectionTags.push(new Tag('Collection-Code', metadata.code));
    }

    if (metadata.banner) {
      const bannerService = new StackService(this.wallet, this.api, service);
      const { object: banner } = await bannerService.create(
        vaultId,
        metadata.banner,
        (<any>metadata.banner).name ? (<any>metadata.banner).name : "Collection banner",
        { parentId: collectionId }
      );
      collectionTags.push(new Tag('Banner', banner.getUri(StorageType.ARWEAVE)));
      collectionMintedState.banner = banner.versions[0];
    } else {
      // if not provided, set the first NFT as a collection banner
      collectionTags.push(new Tag('Banner', nfts[0].object.asset.getUri(StorageType.ARWEAVE)));
      collectionMintedState.banner = nfts[0].object.asset;
    }

    if (metadata.thumbnail) {
      const thumbnailService = new StackService(this.wallet, this.api, service);
      const { object: thumbnail } = await thumbnailService.create(
        vaultId,
        metadata.thumbnail,
        (<any>metadata.thumbnail).name ? (<any>metadata.thumbnail).name : "Collection thumbnail",
        { parentId: collectionId }
      );
      collectionTags.push(new Tag('Thumbnail', thumbnail.getUri(StorageType.ARWEAVE)));
      collectionMintedState.thumbnail = thumbnail.versions[0];
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
   * @param  {string} collectionId
   * @returns Promise with the collection with given id
   */
  public async getCollection(collectionId: string): Promise<Collection> {
    return new Collection(await this.api.getNode<Collection>(collectionId, "Collection"));
  }

  /**
   * @param  {string} collectionId
   * @returns Promise with the collection banner
   */
  public async getCollectionBanner(collectionId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const collection = new Collection(await this.api.getNode<Collection>(collectionId, "Collection"));
    if (collection.banner) {
      const { fileData } = await this.api.downloadFile(collection.banner.getUri(StorageType.S3), options);
      return { data: fileData, ...collection.banner } as FileVersion & { data: ArrayBuffer };
    } else {
      return { data: undefined } as any;
    }
  }

  /**
   * @param  {string} collectionId
   * @returns Promise with the collection thumbnail
   */
  public async getCollectionThumbnail(collectionId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const collection = new Collection(await this.api.getNode<Collection>(collectionId, "Collection"));
    if (collection.thumbnail) {
      const { fileData } = await this.api.downloadFile(collection.thumbnail.getUri(StorageType.S3), options);
      return { data: fileData, ...collection.thumbnail } as FileVersion & { data: ArrayBuffer };
    } else {
      return { data: undefined } as any;
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
    const { items, nextToken } = await this.api.getNodesByVaultId<Collection>(vaultId, "Collection", listOptions);

    return {
      items: items.map((collectionProto: Collection) => new Collection(collectionProto)),
      nextToken: nextToken,
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
    new Tag(smartweaveTags.APP_NAME, 'SmartWeaveContract'),
    new Tag(smartweaveTags.APP_VERSION, '0.3.0'),
    new Tag(smartweaveTags.CONTRACT_SOURCE, metadata.contractTxId || DEFAULT_CONTRACT_SRC),
    new Tag(smartweaveTags.INIT_STATE, JSON.stringify(initState)),
    new Tag(assetTags.TITLE, metadata.name),
    new Tag(assetTags.TYPE, metadata.type || DEFAULT_TYPE),
    new Tag('Contract-Manifest', WARP_MANIFEST),
  ];

  if (metadata.creator) {
    nftTags.push(new Tag('Creator', metadata.creator));
  }
  if (metadata.description) {
    nftTags.push(new Tag(assetTags.DESCRIPTION, metadata.description));
  }
  if (metadata.collection) {
    nftTags.push(new Tag('Collection-Code', metadata.collection));
  }
  if (metadata.topics) {
    for (let topic of metadata.topics) {
      nftTags.push(new Tag(assetTags.TOPIC + ":" + topic, topic));
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