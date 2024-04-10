import { Akord, CollectionMetadata, NFTMetadata, StorageType, UDL, UDL_LICENSE_TX_ID } from "../index";
import faker from '@faker-js/faker';
import { initInstance, testDataPath } from './common';
import { email, password } from './data/test-credentials';
import { NodeJs } from "../types/file";
import { DEFAULT_FRACTION_PARTS } from "../core/nft";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing NFT functions", () => {
  let vaultId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await akord.vault.create(faker.random.words(), {
      public: true,
      cloud: false
    })).vaultId;
  });

  it.skip("should mint an Atomic NFT", async () => {

    const nftName = "IMG_7476.jpeg";
    const file = await NodeJs.File.fromPath(testDataPath + nftName);

    const nftMetadata = {
      name: "Golden Orchid #1",
      owner: "zpCttRSE4zoDmmqu37PwGkwoMI89JsoY9mZx4IfzVb8",
      creator: "oB8a20xgJy9ytEPkrFeIkQ9_6nWuoaNbsQYtaCVkNIY",
      collection: "Flora Fantasy",
      description: "A rare digital representation of the mythical Golden Orchid",
      types: ["image"],
      topics: ["floral", "nature"]
    } as NFTMetadata;

    const udl = {
      licenseFee: { type: "One-Time", value: 10 }
    } as UDL;

    const { nftId, uri } = await akord.nft.mint(vaultId, file, nftMetadata, { udl: udl });

    const nft = await akord.nft.get(nftId);

    expect(nft.status).toEqual("ACTIVE");
    expect(nft.name).toEqual(nftMetadata.name);
    expect(nft.owner).toEqual(nftMetadata.owner);
    expect(nft.creator).toEqual(nftMetadata.creator);
    expect(nft.collection).toEqual(nftMetadata.collection);
    expect(nft.description).toEqual(nftMetadata.description);
    expect(nft.balances[nft.owner]).toEqual(1);
    expect(nft.asset.udl?.license).toEqual(UDL_LICENSE_TX_ID);
    expect(nft.asset.udl?.licenseFee?.type).toEqual(udl.licenseFee?.type);
    expect(nft.asset.udl?.licenseFee?.value).toEqual(udl.licenseFee?.value);

    const { data } = await akord.nft.getAsset(nftId);
    expect(data).toEqual(await file.arrayBuffer());

    expect(uri).toBeTruthy();
    expect(uri).toEqual(nft.asset.getUri(StorageType.ARWEAVE));

    console.log("In few minutes, you can access your NFT on ViewBlock by visiting the following URL:");
    console.log("https://viewblock.io/arweave/tx/" + uri);
  });

  it.skip("should mint a collection", async () => {

    const nftName = "IMG_7476.jpeg";
    const file = await NodeJs.File.fromPath(testDataPath + nftName);

    const collectionMetadata = {
      name: "Flora Fantasy Test",
      owner: "zpCttRSE4zoDmmqu37PwGkwoMI89JsoY9mZx4IfzVb8",
      creator: "oB8a20xgJy9ytEPkrFeIkQ9_6nWuoaNbsQYtaCVkNIY",
      description: "Discover the enchanting world of Flora Fantasy, where nature meets fantasy in mesmerizing digital artworks",
      topics: ["floral", "nature"],
      types: ["image", "collection"],
      fractional: true,
      banner: file,
    } as CollectionMetadata;

    const udl = {
      licenseFee: { type: "One-Time", value: 10 }
    } as UDL;

    const { uri, object: collection, items } = await akord.collection.mint(
      vaultId,
      [{ asset: file, metadata: { name: "Golden Orchid #1" } }],
      collectionMetadata,
      { udl: udl }
    );

    expect(uri).toBeTruthy();
    expect(collection.name).toEqual(collectionMetadata.name);
    expect(collection.owner).toEqual(collectionMetadata.owner);
    expect(collection.creator).toEqual(collectionMetadata.creator);
    expect(collection.description).toEqual(collectionMetadata.description);
    expect(collection.udl?.license).toEqual(UDL_LICENSE_TX_ID);
    expect(collection.udl?.licenseFee?.type).toEqual(udl.licenseFee?.type);
    expect(collection.udl?.licenseFee?.value).toEqual(udl.licenseFee?.value);

    expect(items.length).toEqual(1);
    expect(items[0].uri).toBeTruthy();
    expect(items[0].object).toBeTruthy();

    const nft = items[0].object;
    expect(nft.status).toEqual("ACTIVE");
    expect(nft.name).toEqual("Golden Orchid #1");
    expect(nft.owner).toEqual(collectionMetadata.owner);
    expect(nft.creator).toEqual(collectionMetadata.creator);
    expect(nft.description).toEqual(collectionMetadata.description);
    expect(nft.balances[nft.owner]).toEqual(DEFAULT_FRACTION_PARTS);
    expect(nft.asset.udl?.license).toEqual(UDL_LICENSE_TX_ID);
    expect(nft.asset.udl?.licenseFee?.type).toEqual(udl.licenseFee?.type);
    expect(nft.asset.udl?.licenseFee?.value).toEqual(udl.licenseFee?.value);

    console.log("In few minutes, you can access your collection on ViewBlock by visiting the following URL:");
    console.log("Collection: https://viewblock.io/arweave/tx/" + uri);

    console.log("And the NFT minted within the collection:");
    console.log("NFT: https://viewblock.io/arweave/tx/" + items[0].uri);
  });

  it.skip("should list all nfts & collections for the vault", async () => {

    const nfts = await akord.nft.listAll(vaultId);
    console.log(nfts);
    expect(nfts.length).toEqual(2);
    const collections = await akord.collection.listAll(vaultId);
    console.log(collections);
    expect(collections.length).toEqual(1);
  });
});