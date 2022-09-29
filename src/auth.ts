import Akord from "./akord";
import { AkordWallet } from "@akord/crypto";
import ApiAuthenticator from "./api/akord/api-authenticator";

class Auth {
  apiAuthenticator: ApiAuthenticator;

  constructor() {
    this.apiAuthenticator = new ApiAuthenticator();
  }

  /**
  * @param  {string} email
  * @param  {string} password
  * @returns Promise with Akord Client instance, JWT token & Akord Wallet
  */
  public signIn = async function (email: string, password: string): Promise<{ akord: Akord, wallet: AkordWallet, jwtToken: string }> {
    const jwtToken = await this.apiAuthenticator.getJWTToken(email, password);
    const userAttributes = await this.apiAuthenticator.getUserAttributes(email, password);
    const wallet = await AkordWallet.importFromEncBackupPhrase(password, userAttributes["custom:encBackupPhrase"]);
    return { wallet, jwtToken, akord: new Akord(wallet, jwtToken) };
  };

  /**
  * @param  {string} email
  * @param  {string} password
  * @param  {any} clientMetadata JSON client metadata, ex: { clientType: "CLI" }
  * @returns Promise with Akord Wallet
  */
  public signUp = async function (email: string, password: string, clientMetadata: any = {}): Promise<AkordWallet> {
    const wallet = await AkordWallet.create(password);
    await this.apiAuthenticator.signUp(email, password, {
      email,
      "custom:encBackupPhrase": wallet.encBackupPhrase,
      "custom:publicKey": await wallet.publicKey(),
      "custom:publicSigningKey": await wallet.signingPublicKey(),
      "custom:mode": "dark",
      "custom:notifications": "true",
    }, clientMetadata);
    return wallet;
  };

  /**
  * @param  {string} email
  * @param  {string} code
  * @returns
  */
  public verifyAccount = async function (email: string, code: string): Promise<void> {
    await this.apiAuthenticator.verifyAccount(email, code);
  };
};

export {
  Auth
}