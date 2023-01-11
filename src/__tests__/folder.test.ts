import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import { email, password } from './data/test-credentials';

let akord: Akord;

jest.setTimeout(3000000);

async function vaultCreate() {
  const name = faker.random.words();
  const termsOfAccess = faker.lorem.sentences();
  const { vaultId, membershipId } = await akord.vault.create(name, termsOfAccess);

  const membership = await akord.membership.get(membershipId);
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.role).toEqual("OWNER");

  const vault = await akord.vault.get(vaultId);
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.name).toEqual(name);
  return { vaultId };
}

describe("Testing folder functions", () => {
  let vaultId: string;
  let rootFolderId: string;
  let subFolderId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  it("should create root folder", async () => {
    const name = faker.random.words();
    const { folderId } = await akord.folder.create(vaultId, name);

    rootFolderId = folderId;

    const rootFolder = await akord.folder.get(rootFolderId);
    expect(rootFolder.status).toEqual("ACTIVE");
    expect(rootFolder.parentId).toBeFalsy();
    expect(rootFolder.name).toEqual(name);
  });

  it("should create a sub folder", async () => {
    const name = faker.random.words();
    const { folderId } = await akord.folder.create(vaultId, name, rootFolderId);

    subFolderId = folderId;

    const subFolder = await akord.folder.get(subFolderId);
    expect(subFolder.status).toEqual("ACTIVE");
    expect(subFolder.parentId).toEqual(rootFolderId);
    expect(subFolder.name).toEqual(name);
  });

  it("should revoke root folder", async () => {
    await akord.folder.revoke(rootFolderId);

    const rootFolder = await akord.folder.get(rootFolderId);
    expect(rootFolder.status).toEqual("REVOKED");

    const subFolder = await akord.folder.get(subFolderId);
    expect(subFolder.status).toEqual("REVOKED");
  });

  it("should fail adding new sub-folder to the revoked root folder", async () => {
    const name = faker.random.words();
    await expect(async () =>
      await akord.folder.create(vaultId, name, rootFolderId)
    ).rejects.toThrow(Error);
  });

  it("should restore root folder", async () => {
    await akord.folder.restore(rootFolderId);

    const rootFolder = await akord.folder.get(rootFolderId);
    expect(rootFolder.status).toEqual("ACTIVE");

    const subFolder = await akord.folder.get(subFolderId);
    expect(subFolder.status).toEqual("ACTIVE");
  });
});