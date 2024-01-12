// ANS-110: Asset Discoverability 
// see: https://specs.g8way.io/?tx=SYHBhGAmBo6fgAkINNoRtumOzxNB8-JFv2tPhBuNk5c

import { smartweaveTags } from "../constants";
import { BadRequest } from "../errors/bad-request";
import { Tag, Tags } from "./contract";

export const DEFAULT_CONTRACT_SRC = "Of9pi--Gj7hCTawhgxOwbuWnFI1h24TTgO5pw8ENJNQ"; // Atomic asset contract source
export const WARP_MANIFEST = '{"evaluationOptions":{"sourceType":"redstone-sequencer","allowBigInt":true,"internalWrites":true,"unsafeClient":"skip","useConstructor":true}}';
export const DEFAULT_ASSET_TYPE = "image";

export enum assetTags {
  TITLE = "Title",
  TOPIC = "Topic",
  TYPE = "Type",
  DESCRIPTION = "Description"
};

export type AssetMetadata = {
  name?: string, // max 150 characters
  types?: AssetType[], // default to "image"
  description?: string, // optional description, max 300 characters
  topics?: string[],
}

export type AssetType = "meme" | "image" | "video" | "podcast" | "blog-post" | "social-post" | "music" | "audio"
  | "token" | "web-page" | "profile" | "contract" | "presentation" | "document" | "collection" | "app" | "other";

export const assetTypes = [
  "meme",
  "image",
  "video",
  "podcast",
  "blog-post",
  "social-post",
  "music",
  "audio",
  "token",
  "web-page",
  "profile",
  "contract",
  "presentation",
  "document",
  "collection",
  "app",
  "other"
]

export const validateAssetMetadata = (metadata: AssetMetadata) => {
  if (!metadata?.name || metadata.name.length > 150) {
    throw new BadRequest("Asset name is mandatory and cannot exceed 150 characters.");
  }

  if (metadata?.description?.length > 300) {
    throw new BadRequest("Asset description cannot exceed 300 characters.");
  }

  metadata?.types?.map((type: string) => {
    if (!assetTypes.includes(type)) {
      throw new BadRequest("Invalid asset type: " + type);
    }
  });
}

export const assetMetadataToTags = (metadata: AssetMetadata): Tags => {
  const tags = [
    new Tag(assetTags.TITLE, metadata.name),
  ];

  if (metadata.types && metadata.types.length > 0) {
    for (let type of metadata.types) {
      tags.push(new Tag(assetTags.TYPE, type));
    }
  } else {
    tags.push(new Tag(assetTags.TYPE, DEFAULT_ASSET_TYPE));
  }

  if (metadata.description) {
    tags.push(new Tag(assetTags.DESCRIPTION, metadata.description));
  }

  if (metadata.topics && metadata.topics.length > 0) {
    for (let topic of metadata.topics) {
      tags.push(new Tag(assetTags.TOPIC + ":" + topic, topic));
    }
  }
  return tags;
}

export const atomicContractTags = (state: any, contractTxId?: string): Tags => {
  return [
    new Tag(smartweaveTags.APP_NAME, "SmartWeaveContract"),
    new Tag(smartweaveTags.APP_VERSION, "0.3.0"),
    new Tag(smartweaveTags.CONTRACT_SOURCE, contractTxId || DEFAULT_CONTRACT_SRC),
    new Tag(smartweaveTags.INIT_STATE, JSON.stringify(state)),
    new Tag("Contract-Manifest", WARP_MANIFEST),
  ];
}