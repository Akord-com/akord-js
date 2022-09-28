import Akord from "../akord";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import { email, email2, password, password2 } from './data/test-credentials';

let akord1: Akord;
let akord2: Akord;

jest.setTimeout(3000000);

async function vaultCreate() {
  const name = faker.random.words();
  const termsOfAccess = faker.lorem.sentences();
  const { vaultId, membershipId } = await akord1.vault.create(name, termsOfAccess);

  const membership = await akord1.api.getObject(membershipId, "Membership");
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.state.role).toEqual("OWNER");

  const vault = await akord1.decryptObject(vaultId, "Vault");
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.state.title).toEqual(name);
  return { vaultId };
}

describe("Testing membership commands", () => {
  let vaultId: string;
  let membershipId: string;

  beforeAll(async () => {
    akord1 = await initInstance(email, password);
    akord2 = await initInstance(email2, password2);
    vaultId = (await vaultCreate()).vaultId;
  });

  it("should invite new member", async () => {
    membershipId = (await akord1.membership.invite(vaultId, email2, "CONTRIBUTOR")).membershipId;

    const membership = await akord1.api.getObject(membershipId, "Membership");
    expect(membership.status).toEqual("PENDING");
    expect(membership.state.role).toEqual("CONTRIBUTOR");
  });

  it("should accept the invite", async () => {
    await akord2.membership.accept(membershipId);

    const membership = await akord2.api.getObject(membershipId, "Membership");
    expect(membership.status).toEqual("ACCEPTED");

    // should be able to decrypt the vault name by the new member
    await akord2.decryptObject(vaultId, "Vault");
  });

  it("should fail inviting the same member twice", async () => {
    await expect(async () =>
      akord1.membership.invite(vaultId, email2, "VIEWER")
    ).rejects.toThrow(Error);
  });

  it("should change access", async () => {
    await akord1.membership.changeRole(membershipId, "VIEWER");

    const membership = await akord1.api.getObject(membershipId, "Membership");
    expect(membership.state.role).toEqual("VIEWER");
  });

  it("should revoke the invite", async () => {
    await akord1.membership.revoke(membershipId);

    const membership = await akord1.api.getObject(membershipId, "Membership");
    expect(membership.status).toEqual("REVOKED");
  });
});