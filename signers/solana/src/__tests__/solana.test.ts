import { Akord, Auth } from "@akord/akord-js";
import faker from '@faker-js/faker';
import { AkordWallet } from "@akord/crypto";
import { jwtDecode } from "jwt-decode";
import { SolanaSigner } from "../index";
import solanaWeb3 from "@solana/web3.js"

jest.setTimeout(3000000);

describe("Testing akord-js with Solana signer", () => {
  let signer: SolanaSigner;

  beforeAll(async () => {
    const keypair = solanaWeb3.Keypair.generate();
    signer = new SolanaSigner({ keypair: keypair });
    Auth.configure({ env: "dev" });
  });

  it("should sign up", async () => {
    await Auth.signUpWithWallet({ wallet: signer, walletType: "SOLANA" });
    expect(signer).toBeTruthy();
  });

  it("should sign in", async () => {
    const { jwt } = await Auth.signInWithWallet({ wallet: signer });
    const decodedJWT = jwtDecode(jwt) as any;
    expect(decodedJWT['custom:address']).toEqual(await signer.getAddress());
    expect(decodedJWT['custom:publicSigningKey']).toEqual(await signer.signingPublicKey());
  });

  it("should create public vault", async () => {
    const akord = new Akord({ env: "dev", signer: signer });
    const name = faker.random.words();
    const { vaultId } = await akord.vault.create(name, { cloud: true, public: true });
  
    const vault = await akord.vault.get(vaultId);
    expect(vault.name).toEqual(name);
  });

  it("should add passphrase & create private vault", async () => {
    const encrypter = await AkordWallet.create("YOUR_PASSWORD_HERE");
    await Auth.updateUserAttribute("custom:encBackupPhrase", encrypter.encBackupPhrase);
    await Auth.updateUserAttribute("custom:publicKey", encrypter.publicKey());
    const akord = new Akord({ env: "dev", encrypter: encrypter, signer: signer });
    const name = faker.random.words();
    const { vaultId } = await akord.vault.create(name, { cloud: true, public: false });
  
    const vault = await akord.vault.get(vaultId);
    expect(vault.name).toEqual(name);
  });
});