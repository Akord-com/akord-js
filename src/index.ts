import Akord from "./akord";
import { ClientConfig } from "./client-config";
import { Wallet, AkordWallet } from "@akord/crypto";
import ApiAuthenticator from "./api/akord/api-authenticator";

/**
 * @param  {Wallet} wallet
 * @param  {string} [jwtToken]
 * @param  {ClientConfig={}} config
 * @returns Promise with Akord Client instance
 */
Akord.init = async function (wallet: Wallet, jwtToken?: string, config: ClientConfig = {}): Promise<Akord> {
  return new Akord(wallet, jwtToken, config);
};

/**
 * @param  {string} email
 * @param  {string} password
 * @returns Promise with Akord Client instance
 */
Akord.signIn = async function (email: string, password: string): Promise<Akord> {
  const apiAuthenticator = new ApiAuthenticator();
  const jwtToken = await apiAuthenticator.getJWTToken(email, password);
  const userAttributes = await apiAuthenticator.getUserAttributes(email, password);
  const wallet = await AkordWallet.importFromEncBackupPhrase(password, userAttributes["custom:encBackupPhrase"]);
  return new Akord(wallet, jwtToken);
};

export default Akord;
