import Akord from "../akord";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import { email, password } from './data/test-credentials';

let akord: Akord;

jest.setTimeout(3000000);

async function vaultCreate() {
  const name = faker.random.words();
  const termsOfAccess = faker.lorem.sentences();
  const { vaultId, membershipId } = await akord.vaultCreate(name, termsOfAccess);

  const membership = await akord.api.getObject(membershipId, "Membership");
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.state.role).toEqual("OWNER");

  const vault = await akord.decryptObject(vaultId, "Vault");
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.state.title).toEqual(name);
  return { vaultId };
}

describe("Testing folder commands", () => {
  let vaultId: string;
  let rootFolderId: string;
  let subFolderId: string;

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  it("should create root folder", async () => {
    const name = faker.random.words();
    const { folderId } = await akord.folderCreate(vaultId, name);

    rootFolderId = folderId;

    const rootFolder = await akord.api.getObject(rootFolderId, "Folder");
    expect(rootFolder.status).toEqual("ACTIVE");
    expect(rootFolder.folderId).toEqual(null);

    const decryptedState = await akord.service.processReadObject(rootFolder.state, ["title"]);
    expect(decryptedState.title).toEqual(name);
  });

  it("should create a sub folder", async () => {
    const name = faker.random.words();
    const { folderId } = await akord.folderCreate(vaultId, name, rootFolderId);

    subFolderId = folderId;

    const subFolder = await akord.api.getObject(subFolderId, "Folder");
    expect(subFolder.status).toEqual("ACTIVE");
    expect(subFolder.folderId).toEqual(rootFolderId);

    const decryptedState = await akord.service.processReadObject(subFolder.state, ["title"]);
    expect(decryptedState.title).toEqual(name);
  });

  it("should revoke root folder", async () => {
    await akord.folderRevoke(rootFolderId);

    const rootFolder = await akord.api.getObject(rootFolderId, "Folder");
    expect(rootFolder.status).toEqual("REVOKED");

    const subFolder = await akord.api.getObject(subFolderId, "Folder");
    expect(subFolder.status).toEqual("REVOKED");
  });

  it("should fail adding new sub-folder to the revoked root folder", async () => {
    const name = faker.random.words();
    await expect(async () =>
      await akord.folderCreate(vaultId, name, rootFolderId)
    ).rejects.toThrow(Error);
  });

  it("should restore root folder", async () => {
    await akord.folderRestore(rootFolderId);

    const rootFolder = await akord.api.getObject(rootFolderId, "Folder");
    expect(rootFolder.status).toEqual("ACTIVE");

    const subFolder = await akord.api.getObject(subFolderId, "Folder");
    expect(subFolder.status).toEqual("ACTIVE");
  });
});