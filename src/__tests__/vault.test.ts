import Akord from "../akord";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import { email, password } from './data/test-credentials';

let akord: Akord;

jest.setTimeout(3000000);

async function vaultCreate() {
  const name = faker.random.words();
  const termsOfAccess = faker.lorem.sentences();
  const { vaultId, membershipId } = await akord.vault.create(name, termsOfAccess);

  const membership = await akord.api.getObject(membershipId, "Membership");
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.state.role).toEqual("OWNER");

  const vault = await akord.decryptObject(vaultId, "Vault");
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.state.title).toEqual(name);
  return { vaultId };
}

describe("Testing vault commands", () => {
  let vaultId: any

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  it("should rename the vault", async () => {
    const name = faker.random.words();

    await akord.vault.rename(vaultId, name);

    const vault = await akord.api.getObject(vaultId, "Vault");
    expect(vault.status).toEqual("ACTIVE");

    const decryptedState = await akord.service.processReadObject(vault.state, ["title"]);
    expect(decryptedState.title).toEqual(name);
  });

  it("should archive the vault", async () => {
    await akord.vault.archive(vaultId);

    const vault = await akord.api.getObject(vaultId, "Vault");
    expect(vault.status).toEqual("ARCHIVED");
  });

  it("should fail renaming the archived vault", async () => {
    const name = faker.random.words();
    await expect(async () =>
      await akord.vault.rename(vaultId, name)
    ).rejects.toThrow(Error);
  });

  it("should restore the vault", async () => {
    await akord.vault.restore(vaultId);

    const vault = await akord.api.getObject(vaultId, "Vault");
    expect(vault.status).toEqual("ACTIVE");
  });
});