import { Akord } from "../index";
import { email, email2, password, password2 } from './data/test-credentials';
import { initInstance, vaultCreate } from './common';
import { Membership } from "../types/membership";

let ownerAkordInstance: Akord;
let inviteeAkordInstance: Akord;

jest.setTimeout(3000000);

type Member = {
  publicSigningKey: string,
  address: string,
  name?: string,
  membershipId: string,
  membership?: Membership
}

describe("Testing membership functions", () => {
  let vaultId: string;
  let owner: Member;
  let invitee: Member;

  beforeAll(async () => {
    inviteeAkordInstance = await initInstance(email2, password2);
    const inviteeProfileDetails = await inviteeAkordInstance.profile.get();
    invitee = {
      publicSigningKey: inviteeAkordInstance.vault.wallet.signingPublicKey(),
      address: await inviteeAkordInstance.vault.wallet.getAddress(),
      name: inviteeProfileDetails.name,
      membershipId: ""
    };
    ownerAkordInstance = await initInstance(email, password);
    const ownerProfileDetails = await ownerAkordInstance.profile.get();
    owner = {
      publicSigningKey: ownerAkordInstance.vault.wallet.signingPublicKey(),
      address: await ownerAkordInstance.vault.wallet.getAddress(),
      name: ownerProfileDetails.name,
      membershipId: ""
    };
    const vaultResult = await vaultCreate(ownerAkordInstance);
    vaultId = vaultResult.vaultId;
    owner.membershipId = vaultResult.membershipId;
  });

  it("should invite new member", async () => {
    ownerAkordInstance = await initInstance(email, password);

    invitee.membershipId = (await ownerAkordInstance.membership.invite(vaultId, email2, "CONTRIBUTOR")).membershipId;

    invitee.membership = await ownerAkordInstance.membership.get(invitee.membershipId);
    expect(invitee.membership.status).toEqual("PENDING");
    expect(invitee.membership.role).toEqual("CONTRIBUTOR");
    expect(invitee.membership.memberDetails.name).toBeFalsy();
    expect(invitee.membership.memberPublicSigningKey).toEqual(invitee.publicSigningKey);
    expect(invitee.membership.address).toEqual(invitee.address);
    expect(invitee.membership.owner).toEqual(owner.address);

    owner.membership = await ownerAkordInstance.membership.get(owner.membershipId);
    expect(owner.membership.status).toEqual("ACCEPTED");
    expect(owner.membership.role).toEqual("OWNER");
    expect(owner.membership.memberDetails.name).toEqual(owner.name);
    expect(owner.membership.memberPublicSigningKey).toEqual(owner.publicSigningKey);
    expect(owner.membership.address).toEqual(owner.address);
    expect(owner.membership.owner).toEqual(owner.address);
  });

  it("should accept the invite", async () => {
    inviteeAkordInstance = await initInstance(email2, password2);
    await inviteeAkordInstance.membership.accept(invitee.membershipId);

    invitee.membership = await inviteeAkordInstance.membership.get(invitee.membershipId);
    expect(invitee.membership.status).toEqual("ACCEPTED");
    expect(invitee.membership.memberDetails.name).toEqual(invitee.name);
    expect(invitee.membership.memberPublicSigningKey).toEqual(invitee.publicSigningKey);
    expect(invitee.membership.address).toEqual(invitee.address);
    expect(invitee.membership.owner).toEqual(owner.address);

    // should be able to decrypt the vault name by the new member
    await inviteeAkordInstance.vault.get(vaultId);
  });

  it("should fail inviting the same member twice", async () => {
    ownerAkordInstance = await initInstance(email, password);
    await expect(async () =>
      ownerAkordInstance.membership.invite(vaultId, email2, "VIEWER")
    ).rejects.toThrow(Error);
  });

  it("should change access", async () => {
    ownerAkordInstance = await initInstance(email, password);
    await ownerAkordInstance.membership.changeRole(invitee.membershipId, "VIEWER");

    const membership = await ownerAkordInstance.membership.get(invitee.membershipId);
    expect(membership.role).toEqual("VIEWER");
  });

  it("should revoke the invite", async () => {
    ownerAkordInstance = await initInstance(email, password);
    await ownerAkordInstance.membership.revoke(invitee.membershipId);

    const membership = await ownerAkordInstance.membership.get(invitee.membershipId);
    expect(membership.status).toEqual("REVOKED");

    // should be able to decrypt the vault by the owner
    await ownerAkordInstance.vault.get(vaultId);
  });
});