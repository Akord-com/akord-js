import { Akord } from "./akord";
import { AkordWallet, digest } from "@akord/crypto";
import GUN from "gun";

const gun = GUN(['http://localhost:8765/gun', 'https://gun-manhattan.herokuapp.com/gun']);

class Auth {

  constructor() {}

  /**
  * @param  {string} email
  * @param  {string} password
  * @returns Promise with Akord Client instance & Akord Wallet
  */
  public signIn = async function (email: string, password: string): Promise<{ akord: Akord, wallet: AkordWallet }> {
    const emailHash = await digest(email);
    const walletData = await new Promise(function (resolve, reject) {
      gun.get("akord-js").get("test").get("wallets").get(emailHash).on((data, key) => {
        resolve(data);
      });
    });
    const wallet = await AkordWallet.importFromEncBackupPhrase(password, (<any>walletData).encBackupPhrase);
    return { wallet, akord: new Akord(wallet) };
  };

  /**
  * @param  {string} email
  * @param  {string} password
  * @param  {any} clientMetadata JSON client metadata, ex: { clientType: "CLI" }
  * @returns Promise with Akord Wallet
  */
  public signUp = async function (email: string, password: string, clientMetadata: any = {}): Promise<AkordWallet> {
    const wallet = await AkordWallet.create(password);
    const emailHash = await digest(email);
    await new Promise(async function (resolve, reject) {
      gun.get("akord-js").get("test").get("wallets").get(emailHash).put({
        address: await wallet.getAddress(),
        encBackupPhrase: wallet.encBackupPhrase,
        publicKey: await wallet.publicKey(),
        publicSigningKey: await wallet.signingPublicKey(),
      });
      resolve("");
    });
    return wallet;
  };

  /**
  * @param  {string} email
  * @param  {string} code
  * @returns
  */
  public verifyAccount = async function (email: string, code: string): Promise<void> {
    // await this.apiAuthenticator.verifyAccount(email, code);
  };
};

export {
  Auth
}