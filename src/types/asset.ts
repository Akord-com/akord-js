// ANS-110: Asset Discoverability 
// see: https://specs.g8way.io/?tx=SYHBhGAmBo6fgAkINNoRtumOzxNB8-JFv2tPhBuNk5c

export enum assetTags {
  TITLE = "Title",
  TOPIC = "Topic",
  TYPE = "Type",
  DESCRIPTION = "Description"
};

export type AssetType = "meme" | "image" | "video" | "podcast" | "blog-post" | "social-post" | "music" | "audio"
  | "token" | "web-page" | "profile" | "contract" | "presentation" | "document" | "collection" | "app" | "other";
