import { FileVersion, StorageType, nodeType } from "../types";
import { FileSource } from "../types/file";
import { FileGetOptions, FileModule, createFileLike } from "./file";
import { NFT, NFTMetadata, NFTMintOptions } from "../types/nft";
import { actionRefs, functions } from "../constants";
import { Tag, Tags } from "../types/contract";
import { assetMetadataToTags, atomicContractTags, validateAssetMetadata } from "../types/asset";
import { BadRequest } from "../errors/bad-request";
import { StackModule } from "./stack";
import { isArweaveId } from "../arweave";
import { ServiceConfig } from ".";
import { NodeModule } from "./node";

const DEFAULT_TICKER = "ATOMIC";
export const DEFAULT_FRACTION_PARTS = 100;

class NFTModule extends NodeModule<NFT> {

  constructor(config?: ServiceConfig) {
    super({ ...config, objectType: nodeType.NFT, nodeType: NFT });
  }

  /**
   * @param  {string} vaultId
   * @param  {FileSource} asset file source: web File object, file path, buffer or stream
   * @param  {NFTMetadata} metadata
   * @param  {NFTMintOptions} options
   * @returns Promise with corresponding transaction id
   */
  public async mint(
    vaultId: string,
    asset: FileSource,
    metadata: NFTMetadata,
    options: NFTMintOptions = this.defaultCreateOptions
  ): Promise<{ nftId: string, transactionId: string, object: NFT, uri: string }> {

    const vault = await this.service.api.getVault(vaultId);
    if (!vault.public || vault.cloud) {
      throw new BadRequest("NFT module applies only to public permanent vaults.");
    }

    // validate fields
    validateAssetMetadata(metadata);
    validateWallets(metadata);

    const nftTags = nftMetadataToTags(metadata);

    const createOptions = {
      ...this.defaultCreateOptions,
      ...options
    }
    this.service.setVault(vault);
    this.service.setVaultId(vaultId);
    this.service.setIsPublic(vault.public);
    this.service.setActionRef(actionRefs.NFT_MINT);
    this.service.setFunction(functions.NODE_CREATE);
    this.service.setAkordTags([]);

    createOptions.arweaveTags = (createOptions.arweaveTags || []).concat(nftTags);

    if (createOptions.ucm) {
      createOptions.arweaveTags = createOptions.arweaveTags.concat([new Tag('Indexed-By', 'ucm')]);
    }

    let thumbnail = undefined;
    if (metadata.thumbnail && !metadata.collection) {
      const thumbnailService = new StackModule(this.service);
      const { object } = await thumbnailService.create(
        vaultId,
        metadata.thumbnail
      );
      createOptions.arweaveTags = createOptions.arweaveTags.concat([new Tag('Thumbnail', object.getUri(StorageType.ARWEAVE))]);
      thumbnail = object.versions[0];
    }

    const fileLike = await createFileLike(asset);
    if (fileLike.type) {
      createOptions.arweaveTags.push(new Tag('Content-Type', fileLike.type));
    }
    const fileService = new FileModule(this.service);
    const fileUploadResult = await fileService.create(fileLike, { ...createOptions, storage: StorageType.ARWEAVE });
    const version = await fileService.newVersion(fileLike, fileUploadResult);

    const state = JSON.parse(nftTags.find((tag: Tag) => tag.name === "Init-State").value);
    state.asset = version;
    state.thumbnail = thumbnail;

    const { nodeId, transactionId, object } = await this.service.nodeCreate<NFT>(state, { parentId: options.parentId });
    return { nftId: nodeId, transactionId, object, uri: object.uri };
  }

  /**
   * Get NFT asset
   * @param  {string} nftId
   * @returns Promise with NFT asset
   */
  public async getAsset(nftId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const nft = new NFT(await this.service.api.getNode<NFT>(nftId, "NFT"));
    const { fileData } = await this.service.api.downloadFile(nft.getUri(StorageType.S3), options);
    return { data: fileData, ...nft.asset } as FileVersion & { data: ArrayBuffer };
  }

  /**
   * Get NFT thumbnail
   * @param  {string} nftId
   * @returns Promise with the collection thumbnail
   */
  public async getThumbnail(nftId: string, options: FileGetOptions = { responseType: 'arraybuffer' }): Promise<FileVersion & { data: ArrayBuffer }> {
    const nft = new NFT(await this.service.api.getNode<NFT>(nftId, "NFT"));
    if (nft.thumbnail) {
      const { fileData } = await this.service.api.downloadFile(nft.thumbnail.getUri(StorageType.S3), options);
      return { data: fileData, ...nft.thumbnail } as FileVersion & { data: ArrayBuffer };
    } else {
      return undefined;
    }
  }

  /**
   * Get NFT asset uri
   * @param  {string} nftId
   * @param  {StorageType} [type] storage type, default to arweave
   * @returns Promise with NFT asset uri
   */
  public async getUri(nftId: string, type: StorageType = StorageType.ARWEAVE): Promise<string> {
    const nft = new NFT(await this.service.api.getNode<NFT>(nftId, this.objectType));
    return nft.getUri(type);
  }
};

export const validateWallets = (metadata: NFTMetadata) => {
  if (!metadata?.owner) {
    throw new BadRequest("The NFT owner is mandatory.");
  }

  if (!isArweaveId(metadata?.owner)) {
    throw new BadRequest("The NFT owner needs to be a valid Arweave address.");
  }

  if (metadata?.creator && !isArweaveId(metadata?.creator)) {
    throw new BadRequest("The NFT creator needs to be a valid Arweave address.");
  }
}

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
      [metadata.owner]: metadata.fractional ? (metadata.fractionParts || DEFAULT_FRACTION_PARTS) : 1,
    },
    claimable: []
  } as any;

  const nftTags = atomicContractTags(initState, metadata.contractTxId)

  const assetTags = assetMetadataToTags(metadata);
  nftTags.push(...assetTags);

  if (metadata.creator) {
    nftTags.push(new Tag("Creator", metadata.creator));
  }
  if (metadata.collection) {
    nftTags.push(new Tag("Collection-Code", metadata.collection));
  }
  return nftTags;
}

export {
  NFTModule
}