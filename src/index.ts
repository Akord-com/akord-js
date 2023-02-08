import { Akord } from "./akord";
import { ClientConfig } from "./config";
import { Wallet } from "@akord/crypto";
import { Auth as AkordAuth } from "./auth";

/**
 * @param  {Wallet} wallet
 * @param  {string} [jwtToken]
 * @param  {ClientConfig={}} config
 * @returns Promise with Akord Client instance
 */
Akord.init = async function (wallet: Wallet, jwtToken?: string, config: ClientConfig = {}): Promise<Akord> {
  return new Akord(wallet, jwtToken, config);
};

const Auth = new AkordAuth();

export { Akord, Auth };
