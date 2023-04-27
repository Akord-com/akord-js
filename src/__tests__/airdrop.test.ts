import { Akord } from "../index";
import { initInstance, vaultCreate } from './common';
import { email, email2, email3, password } from './data/test-credentials';
import { AkordWallet } from "@akord/crypto";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing batch actions", () => {
  let vaultId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate(akord)).vaultId;
  });

  describe("Airdrop tests", () => {
    it("should airdrop to existing Akord users", async () => {
      const user1 = await akord.api.getUserPublicData(email2);
      const user2 = await akord.api.getUserPublicData(email3);

      const result = await akord.membership.airdrop(vaultId, [{ ...user1, role: "VIEWER" }, { ...user2, role: "CONTRIBUTOR" }]);
      expect(result.transactionId).toBeTruthy();
      expect(result.members[0].address).toEqual(user1.address);
      expect(result.members[0].id).toBeTruthy();
      expect(result.members[1].address).toEqual(user2.address);
      expect(result.members[1].id).toBeTruthy();
    });

    it("should airdrop to Akord wallets", async () => {
      const wallet1 = await AkordWallet.create(password);
      const wallet2 = await AkordWallet.create(password);
      const user1 = { publicSigningKey: wallet1.signingPublicKey(), publicKey: wallet1.publicKey() };
      const user2 = { publicSigningKey: wallet2.signingPublicKey(), publicKey: wallet2.publicKey() };

      const result = await akord.membership.airdrop(vaultId, [{ ...user1, role: "VIEWER" }, { ...user2, role: "CONTRIBUTOR" }]);
      expect(result.transactionId).toBeTruthy();
      expect(result.members[0].address).toEqual(await wallet1.getAddress());
      expect(result.members[0].id).toBeTruthy();
      expect(result.members[1].address).toEqual(await wallet2.getAddress());
      expect(result.members[1].id).toBeTruthy();
    });
  });
});