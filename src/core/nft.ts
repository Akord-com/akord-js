import { NodeService } from "./node";
import { FileVersion, StackCreateOptions, StorageType, nodeType } from "../types";
import { FileSource } from "../types/file";
import { FileGetOptions, FileService, createFileLike } from "./file";
import { NFT, NFTMetadata } from "../types/nft";
import { actionRefs, functions, smartweaveTags } from "../constants";
import { Tag, Tags } from "../types/contract";
import { assetTags } from "../types/asset";
import { BadRequest } from "../errors/bad-request";
import { StackService } from "./stack";

const DEFAULT_TICKER = "ATOMIC";
const DEFAULT_ASSET_TYPE = "image";
export const DEFAULT_CONTRACT_SRC = "Of9pi--Gj7hCTawhgxOwbuWnFI1h24TTgO5pw8ENJNQ"; // Atomic asset contract source
export const WARP_MANIFEST = '{"evaluationOptions":{"sourceType":"redstone-sequencer","allowBigInt":true,"internalWrites":true,"unsafeClient":"skip","useConstructor":true}}';

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

    if (!metadata?.name || metadata.name.length > 150) {
      throw new BadRequest("metadata.name is mandatory and cannot exceed 150 characters.");
    }

    if (metadata?.description?.length > 300) {
      throw new BadRequest("metadata.description cannot exceed 300 characters.");
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

    let thumbnail = undefined;
    if (metadata.thumbnail && !metadata.collection) {
      const thumbnailService = new StackService(this.wallet, this.api, service);
      const { object } = await thumbnailService.create(
        vaultId,
        metadata.thumbnail,
        (<any>metadata.thumbnail).name ? (<any>metadata.thumbnail).name : "Thumbnail"
      );
      createOptions.arweaveTags = createOptions.arweaveTags.concat([new Tag('Thumbnail', object.getUri(StorageType.ARWEAVE))]);
      thumbnail = object.versions[0];
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
    state.thumbnail = thumbnail;

    const { nodeId, transactionId, object } = await service.nodeCreate<NFT>(state, { parentId: options.parentId });
    return { nftId: nodeId, transactionId, object };
  }

  /**
   * Get NFT asset
   * @param  {string} nftId
   * @returns Promise with NFT asset
   */
  public async getAsset(nftId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const nft = new NFT(await this.api.getNode<NFT>(nftId, "NFT"));
    const { fileData } = await this.api.downloadFile(nft.getUri(StorageType.S3), options);
    return { data: fileData, ...nft.asset } as FileVersion & { data: ArrayBuffer };
  }

  /**
   * Get NFT thumbnail
   * @param  {string} nftId
   * @returns Promise with the collection thumbnail
   */
  public async getThumbnail(nftId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const nft = new NFT(await this.api.getNode<NFT>(nftId, "NFT"));
    if (nft.thumbnail) {
      const { fileData } = await this.api.downloadFile(nft.thumbnail.getUri(StorageType.S3), options);
      return { data: fileData, ...nft.thumbnail } as FileVersion & { data: ArrayBuffer };
    } else {
      return { data: undefined } as any;
    }
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
    new Tag('Contract-Manifest', WARP_MANIFEST),
  ];

  if (metadata.types && metadata.types.length > 0) {
    for (let type of metadata.types) {
      nftTags.push(new Tag(assetTags.TYPE, type));
    }
  } else {
    nftTags.push(new Tag(assetTags.TYPE, DEFAULT_ASSET_TYPE));
  }

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

export {
  NFTService
}