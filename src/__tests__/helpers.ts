import Akord from "../akord";
import { AkordWallet } from "@akord/crypto";
import ApiAuthenticator from "../api/akord/api-authenticator";

export async function initInstance(email: string, password: string) : Promise<Akord> {
  const apiAuthenticator = new ApiAuthenticator();
  const jwtToken = await apiAuthenticator.getJWTToken(email, password);
  const userAttributes = await apiAuthenticator.getUserAttributes(email, password);
  const wallet = await AkordWallet.importFromEncBackupPhrase(password, userAttributes["custom:encBackupPhrase"]);
  return new Akord(wallet, jwtToken, { debug: true });
}