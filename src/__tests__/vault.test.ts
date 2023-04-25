import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance, vaultCreate } from './common';
import { email, password } from './data/test-credentials';

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing vault functions", () => {
  let vaultId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate(akord)).vaultId;
  });

  it("should rename the vault", async () => {
    const name = faker.random.words();

    await akord.vault.rename(vaultId, name);

    const vault = await akord.vault.get(vaultId);
    expect(vault.status).toEqual("ACTIVE");
    expect(vault.name).toEqual(name);
  });

  it("should archive the vault", async () => {
    await akord.vault.archive(vaultId);

    const vault = await akord.vault.get(vaultId);
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

    const vault = await akord.vault.get(vaultId);
    expect(vault.status).toEqual("ACTIVE");
  });
});