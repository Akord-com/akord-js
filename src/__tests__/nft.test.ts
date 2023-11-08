import { Akord, NFTMetadata, StorageType, UDL } from "../index";
import faker from '@faker-js/faker';
import { initInstance, testDataPath } from './common';
import { email, password } from './data/test-credentials';
import { NodeJs } from "../types/file";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing NFT functions", () => {

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
  });

  it.skip("should mint an Atomic NFT", async () => {

    const { vaultId } = await akord.vault.create(faker.random.words(), {
      public: true,
      cacheOnly: false
    });

    const nftName = "IMG_7476.jpeg";
    const file = await NodeJs.File.fromPath(testDataPath + nftName);

    const nftMetadata = {
      name: "Golden Orchid Test",
      creator: "xxxx",
      owner: "yyyy",
      collection: "Flora Fantasy Test",
      description: "A rare digital representation of the mythical Golden Orchid",
      type: "image",
      topics: ["floral", "nature"]
    } as NFTMetadata;

    const udl = {
      licenseFee: { type: "One-Time", value: 10 }
    } as UDL;

    const { nftId } = await akord.nft.mint(vaultId, file, nftMetadata, { udl: udl });

    const nft = await akord.nft.get(nftId);

    expect(nft.status).toEqual("ACTIVE");
    expect(nft.name).toEqual(nftMetadata.name);
    expect(nft.owner).toEqual(nftMetadata.owner);
    expect(nft.creator).toEqual(nftMetadata.creator);
    expect(nft.collection).toEqual(nftMetadata.collection);
    expect(nft.description).toEqual(nftMetadata.description);
    expect(nft.asset.udl?.licenseFee?.type).toEqual(udl.licenseFee?.type);
    expect(nft.asset.udl?.licenseFee?.value).toEqual(udl.licenseFee?.value);
    expect(nft.asset.getUri(StorageType.ARWEAVE)).toBeTruthy();
  });
});
