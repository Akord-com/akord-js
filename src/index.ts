import Akord from "./akord";
import { ClientConfig } from "./client-config";
import { Wallet, AkordWallet } from "@akord/crypto";
import ApiAuthenticator from "./api/akord/api-authenticator";

/**
 * @param  {ClientConfig={}} config
 * @param  {Wallet} wallet
 * @param  {string} [jwtToken]
 * @returns Promise with Akord Client instance
 */
Akord.init = async function (config: ClientConfig = {}, wallet: Wallet, jwtToken?: string): Promise<Akord> {
  return new Akord(config, wallet, jwtToken);
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
  return new Akord({}, wallet, jwtToken);
};

export default Akord;
