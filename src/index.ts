import Akord from "./akord";
import { ClientConfig } from "./client-config";
import { Wallet, AkordWallet } from "@akord/crypto";
import ApiAuthenticator from "./api/akord/api-authenticator";

Akord.init = async function (config: ClientConfig = {}, wallet: Wallet, jwtToken?: string): Promise<Akord> {
  return new Akord(config, wallet, jwtToken);
};

Akord.signIn = async function (email: string, password: string): Promise<Akord> {
  const apiAuthenticator = new ApiAuthenticator();
  const jwtToken = await apiAuthenticator.getJWTToken(email, password);
  const userAttributes = await apiAuthenticator.getUserAttributes(email, password);
  const wallet = await AkordWallet.importFromEncBackupPhrase(password, userAttributes["custom:encBackupPhrase"]);
  return new Akord({}, wallet, jwtToken);
};

export default Akord;
