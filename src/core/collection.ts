import { NodeService } from "./service/node";
import { FileVersion, StorageType, UDL_LICENSE_TX_ID, nodeType, tagNames } from "../types";
import { FileSource } from "../types/file";
import { FileGetOptions } from "./file";
import { NFT, NFTMetadata, NFTMintOptions } from "../types/nft";
import { Collection, CollectionMetadata, CollectionMintOptions } from "../types/collection";
import { actionRefs, functions, objectType } from "../constants";
import { Tag } from "../types/contract";
import { DEFAULT_CONTRACT_SRC, WARP_MANIFEST, assetMetadataToTags, validateAssetMetadata } from "../types/asset";
import { BadRequest } from "../errors/bad-request";
import { mergeState } from "./common";
import { v4 as uuidv4 } from "uuid";
import { StackModule } from "./stack";
import { NodeModule } from "./node";
import { BatchModule } from "./batch";
import { validateWallets } from "./nft";
import { InternalError } from "../errors/internal-error";
import { formatUDL } from "./udl";
import { Logger } from "../logger";
import { Service } from "./service/service";
import { Wallet } from "@akord/crypto";
import { Api } from "../api/api";

class CollectionModule extends NodeModule<Collection> {

  constructor(wallet: Wallet, api: Api, service?: Service) {
    super(wallet, api, Collection, nodeType.COLLECTION, service);
  }

  /**
   * Mint a complete collection of Atomic NFTs, note that each NFT will inherit collection metadata setup
   * @param  {string} vaultId
   * @param  {{asset:FileSource,metadata:NFTMetadata,options:NFTMintOptions}[]} items
   * @param  {CollectionMetadata} metadata
   * @param  {CollectionMintOptions} options
   * @returns Promise with corresponding collection & all minted nfts
   */
  public async mint(
    vaultId: string,
    items: NFTMintItem[],
    metadata: CollectionMetadata,
    options: CollectionMintOptions = this.defaultCreateOptions
  ): Promise<MintCollectionResponse> {

    const { collectionId, object: collection, groupRef } = await this.init(vaultId, items, metadata, options);

    const batchService = new BatchModule(this.service.wallet, this.service.api);
    // batchService.service.groupRef = groupRef;
    const { data, errors } = await batchService.nftMint(
      vaultId,
      items.map((item) => ({
        asset: item.asset,
        metadata: { ...metadata, collection: collection.code, ...item.metadata },
        options: { parentId: collectionId, ...options, ...item.options }
      })),
      options
    );

    if (data.length !== items.length) {
      Logger.log(errors);
      const service = new CollectionModule(this.service.wallet, this.service.api);
      await service.revoke(collectionId, vaultId);
      throw new InternalError("Something went wrong, please try again later or contact Akord support.");
    }

    try {
      const { transactionId, object, uri } = await this.finalize(collection, metadata, data.map((item) => item.object), vaultId, groupRef);
      return {
        object: object,
        collectionId: collection.id,
        transactionId: transactionId,
        uri: uri,
        items: data
      }
    } catch (error) {
      const service = new CollectionModule(this.service.wallet, this.service.api);
      await service.revoke(collectionId, vaultId);
      throw new InternalError("Something went wrong, please try again later or contact Akord support.");
    }
  }

  /**
   * Init collection minting by validating metadata & items to mint
   * @param  {string} vaultId
   * @param  {{asset:FileSource,metadata:NFTMetadata,options:NFTMintOptions}[]} items
   * @param  {CollectionMetadata} metadata
   * @param  {CollectionMintOptions} options
   * @returns Promise with corresponding collection id & collection object
   */
  public async init(
    vaultId: string,
    items: NFTMintItem[],
    metadata: CollectionMetadata,
    options: CollectionMintOptions = this.defaultCreateOptions
  ): Promise<{ collectionId: string, transactionId: string, object: Collection, groupRef: string }> {

    if (!items || items.length === 0) {
      throw new BadRequest("No items provided for minting.");
    }

    // validate fields
    validateAssetMetadata(metadata);
    validateWallets(metadata);

    const vault = await this.service.api.getVault(vaultId);
    if (!vault.public || vault.cacheOnly) {
      throw new BadRequest("NFT module applies only to public permanent vaults.");
    }

    // validate items to mint
    await Promise.all(items.map(async (nft: NFTMintItem) => {
      validateAssetMetadata({ ...metadata, ...nft.metadata });
      validateWallets({ ...metadata, ...nft.metadata });
    }));

    const service = new NodeService<Collection>(this.service.wallet, this.service.api, Collection, objectType.COLLECTION);
    service.setVault(vault);
    service.setVaultId(vaultId);
    service.setIsPublic(vault.public);
    service.setActionRef(actionRefs.COLLECTION_INIT);
    service.setFunction(functions.NODE_CREATE);
    service.setAkordTags([]);
    service.setObjectType("Collection");

    const groupRef = uuidv4();
    service.setGroupRef(groupRef);

    // if no collection code provided, derive one from collection name
    const collectionCode = metadata.code
      ? metadata.code
      : metadata.name.split(' ').join('-') + "-" + JSON.stringify(Date.now());

    const collectionState = {
      owner: metadata.owner,
      creator: metadata.creator,
      name: metadata.name,
      description: metadata.description,
      code: collectionCode,
      udl: formatUDL(options.udl),
      ucm: options.ucm,
    } as any;

    const { nodeId: collectionId, object, transactionId } = await service.nodeCreate<Collection>(collectionState, { parentId: options.parentId });

    return { collectionId, object: new Collection(object), transactionId, groupRef };
  }

  /**
   * Finalize minting the collection by deploying a collection smart contract
   * @param  {Collection} collection
   * @param  {CollectionMetadata} metadata
   * @param  {NFT[]} nfts
   * @returns Promise with corresponding transaction id & collection object
   */
  public async finalize(
    collection: Collection,
    metadata: CollectionMetadata,
    nfts: NFT[],
    vaultId: string,
    groupRef: string
  ): Promise<{ transactionId: string, object: Collection, uri: string }> {
    const mintedItems = nfts.map((nft: NFT) => nft.asset.getUri(StorageType.ARWEAVE));
    const collectionMintedState = {
      type: "Collection",
      items: mintedItems
    } as any;

    const vault = await this.service.api.getVault(vaultId);
    this.service.setObject(collection);
    this.service.setObjectType("Collection");
    this.service.setObjectId(collection.id);
    this.service.setVaultId(vaultId);
    this.service.setVault(vault);
    this.service.setIsPublic(true);
    this.service.setActionRef(actionRefs.COLLECTION_MINT);
    this.service.setFunction(functions.NODE_UPDATE);
    this.service.setGroupRef(groupRef);

    const collectionTags = [
      new Tag("Data-Protocol", "Collection"),
      new Tag("Content-Type", "application/json"),
      new Tag("Name", metadata.name),
      new Tag("Type", "document"),
      new Tag("Vault-Id", vaultId),
      new Tag("Collection-Code", collection.code),
      new Tag(tagNames.LICENSE, UDL_LICENSE_TX_ID),
      new Tag("Contract-Manifest", WARP_MANIFEST),
    ];

    const assetTags = assetMetadataToTags(metadata);
    collectionTags.push(...assetTags);

    if (metadata.creator) {
      collectionTags.push(new Tag("Creator", metadata.creator));
    }

    const collectionState = mergeState({
      owner: metadata.owner,
      creator: metadata.creator,
      name: metadata.name,
      description: metadata.description,
      code: collection.code,
      udl: collection.udl,
      ucm: collection.ucm,
    }, collectionMintedState);

    if (metadata.banner) {
      const bannerService = new StackModule(this.service.wallet, this.service.api, this.service);
      const { object: banner } = await bannerService.create(
        vaultId,
        metadata.banner,
        { parentId: collection.id }
      );
      collectionTags.push(new Tag("Banner", banner.getUri(StorageType.ARWEAVE)));
      collectionState.banner = banner.versions[0];
    } else {
      // if not provided, set the first NFT as a collection banner
      collectionTags.push(new Tag("Banner", nfts[0].asset.getUri(StorageType.ARWEAVE)));
      collectionState.banner = nfts[0].asset;
    }

    if (metadata.thumbnail) {
      const thumbnailService = new StackModule(this.service.wallet, this.service.api, this.service);
      const { object: thumbnail } = await thumbnailService.create(
        vaultId,
        metadata.thumbnail,
        { parentId: collection.id }
      );
      collectionTags.push(new Tag("Thumbnail", thumbnail.getUri(StorageType.ARWEAVE)));
      collectionState.thumbnail = thumbnail.versions[0];
    }

    this.service.arweaveTags = await this.service.getTxTags();

    const contractDeployData = {
      contractSrcTxId: metadata.contractTxId || DEFAULT_CONTRACT_SRC,
      state: collectionMintedState,
      tags: collectionTags
    };

    const { transactionId, object } = await this.service.nodeUpdate<Collection>(collectionState, undefined, contractDeployData);

    return {
      transactionId: transactionId,
      object: object,
      uri: object.uri
    }
  }

  /**
   * @param  {string} collectionId
   * @returns Promise with the collection banner
   */
  public async getBanner(collectionId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const collection = new Collection(await this.service.api.getNode<Collection>(collectionId, "Collection"));
    if (collection.banner) {
      const { fileData } = await this.service.api.downloadFile(collection.banner.getUri(StorageType.S3), options);
      return { data: fileData, ...collection.banner } as FileVersion & { data: ArrayBuffer };
    } else {
      return undefined;
    }
  }

  /**
   * @param  {string} collectionId
   * @returns Promise with the collection thumbnail
   */
  public async getThumbnail(collectionId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer } | undefined> {
    const collection = new Collection(await this.service.api.getNode<Collection>(collectionId, "Collection"));
    if (collection.thumbnail) {
      const { fileData } = await this.service.api.downloadFile(collection.thumbnail.getUri(StorageType.S3), options);
      return { data: fileData, ...collection.thumbnail } as FileVersion & { data: ArrayBuffer };
    } else {
      return undefined;
    }
  }
};

export type NFTMintItem = {
  asset: FileSource,
  metadata: NFTMetadata,
  options?: NFTMintOptions
}

export type NFTResponseItem = {
  nftId: string,
  transactionId: string,
  object: NFT,
  uri: string
}

export interface MintCollectionResponse {
  object: Collection,
  uri: string,
  collectionId: string,
  transactionId: string,
  items: Array<NFTResponseItem>
}

export {
  CollectionModule
}