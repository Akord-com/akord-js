import { Akord } from "./akord";
import { ClientConfig } from "./config";
import { Wallet } from "@akord/crypto";
import { Auth } from "@akord/akord-auth";

/**
 * @param  {Wallet} wallet
 * @param  {ClientConfig={}} config
 * @returns Promise with Akord Client instance
 */
Akord.init = async function (wallet: Wallet, config: ClientConfig = {}): Promise<Akord> {
  Auth.configure(config);
  return new Akord(wallet, config);
};

export { Akord, Auth };
