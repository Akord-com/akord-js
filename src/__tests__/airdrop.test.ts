import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import { email, email2, email3, password } from './data/test-credentials';

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

describe("Testing batch actions", () => {
  let vaultId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  describe("Airdrop tests", () => {
    it("should airdrop to existing Akord users", async () => {
      const user1 = await akord.api.getUserFromEmail(email2);
      const user2 = await akord.api.getUserFromEmail(email3);

      const result = await akord.membership.airdrop(vaultId, [user1, user2], "VIEWER");
      console.log(result);
    });
  });
});