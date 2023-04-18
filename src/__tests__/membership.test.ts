import { Akord } from "../index";
import { initInstance, vaultCreate } from './common';
import { email, email2, password, password2 } from './data/test-credentials';

let akord1: Akord;
let akord2: Akord;

jest.setTimeout(3000000);

describe("Testing membership functions", () => {
  let vaultId: string;
  let membershipId: string;

  beforeAll(async () => {
    akord1 = await initInstance(email, password);
    vaultId = (await vaultCreate(akord1)).vaultId;
  });

  it("should invite new member", async () => {
    akord1 = await initInstance(email, password);
    membershipId = (await akord1.membership.invite(vaultId, email2, "CONTRIBUTOR")).membershipId;

    const membership = await akord1.membership.get(membershipId);
    expect(membership.status).toEqual("PENDING");
    expect(membership.role).toEqual("CONTRIBUTOR");
  });

  it("should accept the invite", async () => {
    akord2 = await initInstance(email2, password2);
    await akord2.membership.accept(membershipId);

    const membership = await akord2.membership.get(membershipId);
    expect(membership.status).toEqual("ACCEPTED");

    // should be able to decrypt the vault name by the new member
    await akord2.vault.get(vaultId);
  });

  it("should fail inviting the same member twice", async () => {
    akord1 = await initInstance(email, password);
    await expect(async () =>
      akord1.membership.invite(vaultId, email2, "VIEWER")
    ).rejects.toThrow(Error);
  });

  it("should change access", async () => {
    akord1 = await initInstance(email, password);
    await akord1.membership.changeRole(membershipId, "VIEWER");

    const membership = await akord1.membership.get(membershipId);
    expect(membership.role).toEqual("VIEWER");
  });

  it("should revoke the invite", async () => {
    akord1 = await initInstance(email, password);
    await akord1.membership.revoke(membershipId);

    const membership = await akord1.membership.get(membershipId);
    expect(membership.status).toEqual("REVOKED");

    // should be able to decrypt the vault by the owner
    await akord1.vault.get(vaultId);
  });
});