import { StackCreateItem } from "../core/batch";
import { Akord, Auth } from "../index";
import { initInstance, testDataPath, vaultCreate } from './common';
import { email, email2, email3, password } from './data/test-credentials';
import { AkordWallet } from "@akord/crypto";
import fs from "fs";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing airdrop actions", () => {
  let vaultId: string;
  let airdropee: AkordWallet;

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

    it("should airdrop access with 10MB storage allowance", async () => {
      const allowedStorage = 10;

      airdropee = await AkordWallet.create();

      vaultId = (await akord.vault.create(airdropee.signingPublicKey(), { cloud: false })).vaultId;
      await akord.membership.airdrop(vaultId, [
        {
          publicSigningKey: airdropee.signingPublicKey(),
          publicKey: airdropee.publicKey(),
          role: "CONTRIBUTOR",
          options: {
            expirationDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
            allowedStorage: allowedStorage
          }
        }
      ]);
    });

    it("should upload files to the vault by airdropee", async () => {
      Auth.configure({ env: "dev" });
      await Auth.signInWithWallet(airdropee);
      const airdropeeAkordInstance = new Akord(airdropee, { env: "dev" });

      const type = "image/png";
      const fileName = "logo.png";
      const fileBuffer = fs.readFileSync(testDataPath + fileName);

      const items = [] as StackCreateItem[];

      for (let i = 0; i < 10; i++) {
        items.push({ file: fileBuffer, options: { name: fileName } });
      }

      const { data, errors } = await airdropeeAkordInstance.batch.stackCreate(vaultId, items);
      expect(errors.length).toEqual(0);
      expect(data.length).toEqual(10);
      for (let item of data) {
        expect(item.uri).toBeTruthy();
        expect(item.object.versions[0].type).toEqual(type);
      }
    });
  });
});