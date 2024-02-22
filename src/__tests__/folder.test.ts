import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance, folderCreate, vaultCreate } from './common';
import { email, password } from './data/test-credentials';
import { BadRequest } from "../errors/bad-request";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing folder functions", () => {
  let vaultId: string;
  let rootFolderId: string;
  let subFolderId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate(akord)).vaultId;
  });

  it("should create root folder", async () => {
    rootFolderId = await folderCreate(akord, vaultId);
  });

  it("should create a sub folder", async () => {
    subFolderId = await folderCreate(akord, vaultId, rootFolderId);
  });

  it("should revoke root folder", async () => {
    await akord.folder.revoke(rootFolderId);

    const rootFolder = await akord.folder.get(rootFolderId);
    expect(rootFolder.status).toEqual("REVOKED");

    const subFolder = await akord.folder.get(subFolderId);
    expect(subFolder.status).toEqual("REVOKED");
  });

  it.skip("should fail adding new sub-folder to the revoked root folder", async () => {
    const name = faker.random.words();
    await expect(async () =>
      await akord.folder.create(vaultId, name, { parentId: rootFolderId })
    ).rejects.toThrow(BadRequest);
  });

  it("should restore root folder", async () => {
    await akord.folder.restore(rootFolderId);

    const rootFolder = await akord.folder.get(rootFolderId);
    expect(rootFolder.status).toEqual("ACTIVE");

    const subFolder = await akord.folder.get(subFolderId);
    expect(subFolder.status).toEqual("ACTIVE");
  });
});