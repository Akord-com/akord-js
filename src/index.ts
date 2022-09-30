import Akord from "./akord";
import { ClientConfig } from "./client-config";
import { Wallet } from "@akord/crypto";

/**
 * @param  {Wallet} wallet
 * @param  {string} [jwtToken]
 * @param  {ClientConfig={}} config
 * @returns Promise with Akord Client instance
 */
Akord.init = async function (wallet: Wallet, jwtToken?: string, config: ClientConfig = {}): Promise<Akord> {
  return new Akord(wallet, jwtToken, config);
};

export default Akord;
