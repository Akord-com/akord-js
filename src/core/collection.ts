import { NodeService } from "./node";
import { FileVersion, StackCreateOptions, StorageType, UDL_LICENSE_TX_ID, nodeType, tagNames } from "../types";
import { FileSource } from "../types/file";
import { FileGetOptions, createFileLike } from "./file";
import { NFT, NFTMetadata } from "../types/nft";
import { Collection, CollectionMetadata } from "../types/collection";
import { actionRefs, functions, smartweaveTags } from "../constants";
import { Tag } from "../types/contract";
import { assetTags } from "../types/asset";
import { BadRequest } from "../errors/bad-request";
import { mergeState } from "./common";
import { v4 as uuidv4 } from "uuid";
import { StackService } from "./stack";
import { Logger } from "../logger";
import { batchProgressCount } from "./batch";
import { DEFAULT_CONTRACT_SRC, NFTService, WARP_MANIFEST } from "./nft";
import { InternalError } from "../errors/internal-error";

class CollectionService extends NodeService<Collection> {
  objectType = nodeType.COLLECTION;
  NodeType = Collection;

  /**
   * Mint a collection of Atomic NFTs, note that each NFT will inherit collection metadata setup
   * @param  {string} vaultId
   * @param  {{asset:FileSource,metadata:NFTMetadata,options:StackCreateOptions}[]} items
   * @param  {CollectionMetadata} metadata
   * @param  {StackCreateOptions} options
   * @returns Promise with corresponding transaction id
   */
  public async mint(
    vaultId: string,
    items: NFTMintItem[],
    metadata: CollectionMetadata,
    options: StackCreateOptions = this.defaultCreateOptions
  ): Promise<MintCollectionResponse> {

    if (!items || items.length === 0) {
      throw new BadRequest("No items provided for minting.");
    }

    if (!metadata?.name || metadata.name.length > 150) {
      throw new BadRequest("metadata.name is mandatory and cannot exceed 150 characters.");
    }

    if (metadata?.description?.length > 300) {
      throw new BadRequest("metadata.description cannot exceed 300 characters.");
    }

    const vault = await this.api.getVault(vaultId);
    if (!vault.public || vault.cacheOnly) {
      throw new BadRequest("NFT module applies only to public permanent vaults.");
    }

    // validate items to mint
    const itemsToMint = await Promise.all(items.map(async (nft: NFTMintItem) => {
      if (!nft.metadata?.name || nft.metadata.name.length > 150) {
        throw new BadRequest("metadata.name is mandatory and cannot exceed 150 characters.");
      }
      if (nft.metadata?.description?.length > 300) {
        throw new BadRequest("metadata.description cannot exceed 300 characters.");
      }
      const fileLike = await createFileLike(nft.asset, { ...options, ...nft.options });
      return { asset: fileLike, metadata: nft.metadata, options: nft.options };
    }));

    const batchSize = itemsToMint.reduce((sum, nft) => {
      return sum + nft.asset.size;
    }, 0);
    batchProgressCount(batchSize, options);

    const mintedItems = [] as string[];
    const nfts = [] as MintCollectionResponse["data"]["items"];
    const errors = [] as MintCollectionResponse["errors"];

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

    const { nodeId: collectionId } = await service.nodeCreate<Collection>(collectionState, { parentId: options.parentId });

    for (const chunk of [...chunks(itemsToMint, BATCH_CHUNK_SIZE)]) {
      await Promise.all(chunk.map(async (nft) => {
        try {
          const nftService = new NFTService(this.wallet, this.api, service);
          nftService.setObjectType("NFT");
          const { nftId, transactionId, object } = await nftService.mint(
            vaultId,
            nft.asset,
            { ...metadata, collection: collectionCode, ...nft.metadata },
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
      const nodeService = new NodeService<Collection>(this.wallet, this.api, service);
      try {
        await nodeService.revoke(collectionId, vaultId);
      } catch (error) {
        throw new InternalError("Something went wrong, please try again later or contact Akord support.");
      }
      return {
        data: { items: nfts, collectionId: undefined, transactionId: undefined, object: undefined },
        errors,
      }
    }

    try {
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
        new Tag(assetTags.TYPE, "document"),
        new Tag('Contract-Manifest', WARP_MANIFEST),
        new Tag('Vault-Id', vaultId),
        new Tag('Collection-Code', collectionCode),
        new Tag(tagNames.LICENSE, UDL_LICENSE_TX_ID)
      ];

      if (metadata.description) {
        collectionTags.push(new Tag(assetTags.DESCRIPTION, metadata.description));
      }

      if (metadata.creator) {
        collectionTags.push(new Tag('Creator', metadata.creator));
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
    } catch (error) {
      const nodeService = new NodeService<Collection>(this.wallet, this.api, service);
      try {
        await nodeService.revoke(collectionId, vaultId);
      } catch (error) {
        throw new InternalError("Something went wrong, please try again later or contact Akord support.");
      }
      return {
        data: { items: nfts, collectionId: undefined, transactionId: undefined, object: undefined },
        errors,
      }
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
      return { data: undefined } as any;
    }
  }

  /**
   * @param  {string} collectionId
   * @returns Promise with the collection thumbnail
   */
  public async getThumbnail(collectionId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const collection = new Collection(await this.api.getNode<Collection>(collectionId, "Collection"));
    if (collection.thumbnail) {
      const { fileData } = await this.api.downloadFile(collection.thumbnail.getUri(StorageType.S3), options);
      return { data: fileData, ...collection.thumbnail } as FileVersion & { data: ArrayBuffer };
    } else {
      return { data: undefined } as any;
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
  CollectionService
}