import { NodeService } from "./node";
import { FileVersion, StackCreateOptions, StorageType, nodeType } from "../types";
import { FileLike } from "../types/file";
import { FileGetOptions, FileService } from "./file";
import { NFT, NFTMetadata } from "../types/nft";
import { actionRefs, functions, smartweaveTags } from "../constants";
import { Tag, Tags } from "../types/contract";
import { assetTags } from "../types/asset";
import { BadRequest } from "../errors/bad-request";

const DEFAULT_TICKER = "ATOMIC";
const DEFAULT_CONTRACT_SRC = "Of9pi--Gj7hCTawhgxOwbuWnFI1h24TTgO5pw8ENJNQ"; // Atomic asset contract source

class NFTService extends NodeService<NFT> {
  objectType = nodeType.NFT;
  NodeType = NFT;

  /**
   * @param  {string} vaultId
   * @param  {FileLike} asset
   * @param  {NFTMetadata} metadata
   * @param  {StackCreateOptions} options
   * @returns Promise with corresponding transaction id
   */
  public async mint(
    vaultId: string,
    asset: FileLike,
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
    const service = new NFTService(this.wallet, this.api);
    service.setVault(vault);
    service.setVaultId(vaultId);
    service.setIsPublic(vault.public);
    await service.setMembershipKeys(vault);
    service.setActionRef(actionRefs.NFT_MINT);
    service.setFunction(functions.NODE_CREATE);
    service.setAkordTags([]);

    createOptions.arweaveTags = (createOptions.arweaveTags || [{ name: 'Content-Type', value: asset.type }]).concat(nftTags);
    createOptions.cacheOnly = service.vault.cacheOnly;

    if (createOptions.ucm) {
      createOptions.arweaveTags = createOptions.arweaveTags.concat([{ name: 'Indexed-By', value: 'ucm' }]);
    }

    const fileService = new FileService(this.wallet, this.api, service);
    const fileUploadResult = await fileService.create(asset, createOptions);
    const version = await fileService.newVersion(asset, fileUploadResult);

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

export {
  NFTService
}