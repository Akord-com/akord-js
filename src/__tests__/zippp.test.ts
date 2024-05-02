import { Akord } from "../index";
import { initInstance, testDataPath, vaultCreate } from './common';
import { email, password } from './data/test-credentials';
import { zipFileName } from './data/content';
import faker from "@faker-js/faker";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing zip functions", () => {

  beforeAll(async () => {
    akord = await initInstance(email, password);
  });

  it("should upload zip from path", async () => {
    const { items, nextToken } = await akord.zip.list();
    const files = await akord.file.list({ sourceId: "f92015d9-e859-4877-9f98-e5100cec9a2d"});
    console.log(files)
  });
});
