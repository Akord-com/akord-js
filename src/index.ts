import Akord from "./akord";
import { ClientConfig } from "./client-config";
import { Wallet } from "@akord/crypto";
import { Auth } from "./auth";

/**
 * @param  {Wallet} wallet
 * @param  {string} [jwtToken]
 * @param  {ClientConfig={}} config
 * @returns Promise with Akord Client instance
 */
Akord.init = async function (wallet: Wallet, jwtToken?: string, config: ClientConfig = {}): Promise<Akord> {
  return new Akord(wallet, jwtToken, config);
};

Akord.auth = new Auth();

export default Akord;
