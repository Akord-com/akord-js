import { NodeService } from "./node";
import { FileVersion, StackCreateOptions, StorageType, UDL_LICENSE_TX_ID, nodeType, tagNames } from "../types";
import { FileSource } from "../types/file";
import { FileGetOptions, createFileLike } from "./file";
import { NFT, NFTMetadata } from "../types/nft";
import { Collection, CollectionMetadata } from "../types/collection";
import { actionRefs, functions } from "../constants";
import { Tag } from "../types/contract";
import { assetMetadataToTags, atomicContractTags, validateAssetMetadata } from "../types/asset";
import { BadRequest } from "../errors/bad-request";
import { mergeState } from "./common";
import { v4 as uuidv4 } from "uuid";
import { StackService } from "./stack";
import { Logger } from "../logger";
import { batchProgressCount } from "./batch";
import { NFTService } from "./nft";
import { InternalError } from "../errors/internal-error";

class CollectionService extends NodeService<Collection> {
  objectType = nodeType.COLLECTION;
  NodeType = Collection;

  /**
   * Mint a complete collection of Atomic NFTs, note that each NFT will inherit collection metadata setup
   * @param  {string} vaultId
   * @param  {{asset:FileSource,metadata:NFTMetadata,options:StackCreateOptions}[]} items
   * @param  {CollectionMetadata} metadata
   * @param  {StackCreateOptions} options
   * @returns Promise with corresponding collection & all minted nfts
   */
  public async mint(
    vaultId: string,
    items: NFTMintItem[],
    metadata: CollectionMetadata,
    options: StackCreateOptions = this.defaultCreateOptions
  ): Promise<MintCollectionResponse> {

    const { collectionId, object: collection } = await this.init(vaultId, items, metadata, options);

    const mintedItems = [] as string[];
    const nfts = [] as NFTResponseItem[];
    const errors = [] as any;

    for (const chunk of [...chunks(items, BATCH_CHUNK_SIZE)]) {
      await Promise.all(chunk.map(async (nft) => {
        try {
          const nftService = new NFTService(this.wallet, this.api);
          const { nftId, transactionId, object } = await nftService.mint(
            vaultId,
            nft.asset,
            { ...metadata, collection: collection.code, ...nft.metadata },
            { parentId: collectionId, ...options, ...nft.options }
          );
          mintedItems.push(object.getUri(StorageType.ARWEAVE));
          nfts.push({ nftId, transactionId, object });
        } catch (error) {
          Logger.log("Minting the atomic asset failed.");
          Logger.log(error);
          errors.push({ name: nft.metadata?.name, message: error.message, error: error });
        }
      }))
    }

    if (mintedItems.length !== items.length) {
      const nodeService = new NodeService<Collection>(this.wallet, this.api);
      try {
        await nodeService.revoke(collectionId, vaultId);
        throw new InternalError("Something went wrong, please try again later or contact Akord support.");
      } catch (error) {
        throw new InternalError("Something went wrong, please try again later or contact Akord support.");
      }
    }

    try {
      const { transactionId, object } = await this.finalize(collection, metadata, nfts.map((item) => item.object));
      return {
        object,
        collectionId: collection.id,
        transactionId: transactionId,
        items: nfts
      }
    } catch (error) {
      const nodeService = new NodeService<Collection>(this.wallet, this.api);
      try {
        await nodeService.revoke(collectionId, vaultId);
        throw new InternalError("Something went wrong, please try again later or contact Akord support.");
      } catch (error) {
        throw new InternalError("Something went wrong, please try again later or contact Akord support.");
      }
    }
  }

  /**
   * Init collection minting by validating metadata & items to mint
   * @param  {string} vaultId
   * @param  {{asset:FileSource,metadata:NFTMetadata,options:StackCreateOptions}[]} items
   * @param  {CollectionMetadata} metadata
   * @param  {StackCreateOptions} options
   * @returns Promise with corresponding collection id & collection object
   */
  public async init(
    vaultId: string,
    items: NFTMintItem[],
    metadata: CollectionMetadata,
    options: StackCreateOptions = this.defaultCreateOptions
  ): Promise<{ collectionId: string, transactionId: string, object: Collection }> {

    if (!items || items.length === 0) {
      throw new BadRequest("No items provided for minting.");
    }

    validateAssetMetadata(metadata);

    const vault = await this.api.getVault(vaultId);
    if (!vault.public || vault.cacheOnly) {
      throw new BadRequest("NFT module applies only to public permanent vaults.");
    }

    // validate items to mint
    const itemsToMint = await Promise.all(items.map(async (nft: NFTMintItem) => {
      validateAssetMetadata(nft.metadata);
      const fileLike = await createFileLike(nft.asset, { ...options, ...nft.options });
      return { asset: fileLike, metadata: nft.metadata, options: nft.options };
    }));

    const batchSize = itemsToMint.reduce((sum, nft) => {
      return sum + nft.asset.size;
    }, 0);
    batchProgressCount(batchSize, options);

    const service = new CollectionService(this.wallet, this.api);
    service.setVault(vault);
    service.setVaultId(vaultId);
    service.setIsPublic(vault.public);
    service.setActionRef(actionRefs.NFT_MINT_COLLECTION);
    service.setFunction(functions.NODE_CREATE);
    service.setAkordTags([]);
    service.setObjectType("Collection");

    service.setGroupRef(uuidv4());

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
      udl: options.udl,
      ucm: options.ucm,
    } as any;

    const { nodeId: collectionId, object, transactionId } = await service.nodeCreate<Collection>(collectionState, { parentId: options.parentId });

    return { collectionId, object, transactionId };
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
    nfts: NFT[]
  ): Promise<{ transactionId: string, object: Collection }> {
    const mintedItems = nfts.map((nft: NFT) => nft.asset.getUri(StorageType.ARWEAVE));
    const collectionMintedState = {
      type: "Collection",
      items: mintedItems
    } as any;

    const service = new CollectionService(this.wallet, this.api);
    service.setObject(collection);
    service.setObjectType("Collection");
    service.setObjectId(collection.id);
    service.setVaultId(collection.vaultId);
    service.setIsPublic(true);
    service.setActionRef(actionRefs.NFT_MINT_COLLECTION);
    service.setFunction(functions.NODE_UPDATE);

    const collectionTags = [
      new Tag("Data-Protocol", "Collection"),
      new Tag("Content-Type", "application/json"),
      new Tag("Name", metadata.name),
      new Tag("Type", "document"),
      new Tag("Vault-Id", collection.vaultId),
      new Tag("Collection-Code", collection.code),
      new Tag(tagNames.LICENSE, UDL_LICENSE_TX_ID)
    ];

    const contractTags = atomicContractTags(collectionMintedState, metadata.contractTxId);
    collectionTags.push(...contractTags);

    const assetTags = assetMetadataToTags(metadata);
    collectionTags.push(...assetTags);

    if (metadata.creator) {
      collectionTags.push(new Tag("Creator", metadata.creator));
    }

    if (metadata.banner) {
      const bannerService = new StackService(this.wallet, this.api, service);
      const { object: banner } = await bannerService.create(
        collection.vaultId,
        metadata.banner,
        (<any>metadata.banner).name ? (<any>metadata.banner).name : "Collection banner",
        { parentId: collection.id }
      );
      collectionTags.push(new Tag("Banner", banner.getUri(StorageType.ARWEAVE)));
      collectionMintedState.banner = banner.versions[0];
    } else {
      // if not provided, set the first NFT as a collection banner
      collectionTags.push(new Tag("Banner", nfts[0].asset.getUri(StorageType.ARWEAVE)));
      collectionMintedState.banner = nfts[0].asset;
    }

    if (metadata.thumbnail) {
      const thumbnailService = new StackService(this.wallet, this.api, service);
      const { object: thumbnail } = await thumbnailService.create(
        collection.vaultId,
        metadata.thumbnail,
        (<any>metadata.thumbnail).name ? (<any>metadata.thumbnail).name : "Collection thumbnail",
        { parentId: collection.id }
      );
      collectionTags.push(new Tag("Thumbnail", thumbnail.getUri(StorageType.ARWEAVE)));
      collectionMintedState.thumbnail = thumbnail.versions[0];
    }

    service.arweaveTags = await service.getTxTags();

    const mergedState = mergeState({
      owner: metadata.owner,
      creator: metadata.creator,
      name: metadata.name,
      description: metadata.description,
      code: collection.code,
      udl: collection.udl,
      ucm: collection.ucm,
    }, collectionMintedState);

    const ids = await service.api.uploadData([{ data: mergedState, tags: collectionTags }]);

    const { id, object } = await service.api.postContractTransaction<Collection>(
      service.vaultId,
      { function: service.function, data: ids[0] },
      service.arweaveTags
    );
    return {
      transactionId: id,
      object: object
    }
  }

  /**
   * @param  {string} collectionId
   * @returns Promise with the collection banner
   */
  public async getBanner(collectionId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const collection = new Collection(await this.api.getNode<Collection>(collectionId, "Collection"));
    if (collection.banner) {
      const { fileData } = await this.api.downloadFile(collection.banner.getUri(StorageType.S3), options);
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
    const collection = new Collection(await this.api.getNode<Collection>(collectionId, "Collection"));
    if (collection.thumbnail) {
      const { fileData } = await this.api.downloadFile(collection.thumbnail.getUri(StorageType.S3), options);
      return { data: fileData, ...collection.thumbnail } as FileVersion & { data: ArrayBuffer };
    } else {
      return undefined;
    }
  }
};

const BATCH_CHUNK_SIZE = 50;

function* chunks<T>(arr: T[], n: number): Generator<T[], void> {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n);
  }
}

export type NFTMintItem = {
  asset: FileSource,
  metadata: NFTMetadata,
  options?: StackCreateOptions
}

export type NFTResponseItem = {
  nftId: string,
  transactionId: string,
  object: NFT
}

export interface MintCollectionResponse {
  object: Collection,
  collectionId: string,
  transactionId: string,
  items: Array<NFTResponseItem>
}

export {
  CollectionService
}