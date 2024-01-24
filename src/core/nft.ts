import { NodeService } from "./node";
import { FileVersion, StackCreateOptions, StorageType, nodeType } from "../types";
import { FileSource } from "../types/file";
import { FileGetOptions, FileService, createFileLike } from "./file";
import { NFT, NFTMetadata } from "../types/nft";
import { actionRefs, functions } from "../constants";
import { Tag, Tags } from "../types/contract";
import { assetMetadataToTags, atomicContractTags, validateAssetMetadata } from "../types/asset";
import { BadRequest } from "../errors/bad-request";
import { StackService } from "./stack";

const DEFAULT_TICKER = "ATOMIC";

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

    validateAssetMetadata(metadata);

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
    createOptions.storage = StorageType.ARWEAVE;
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
  NFTService
}