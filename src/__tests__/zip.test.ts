import { Akord } from "../index";
import { initInstance, testDataPath, vaultCreate } from './common';
import { email, password } from './data/test-credentials';
import { zipFileName } from './data/content';
import faker from "@faker-js/faker";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing zip functions", () => {
  let vaultId: string;

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await akord.vault.create(faker.random.words(), {
      public: true,
      cloud: true
    })).vaultId;
    console.log("vaultId: " + vaultId)
  });

  it("should upload zip from path", async () => {
    await akord.zip.upload(vaultId, testDataPath + zipFileName);
  });
});
