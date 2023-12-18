import { objectType } from "../constants";
import { Paginated } from "../types/paginated";
import { ListOptions } from "../types/query-options";
import { Whitelist, WhitelistConfig } from "../types/whitelist";
import { paginate } from "./common";
import { Service } from "./service";

class WhitelistService extends Service {
  objectType = objectType.WHITELIST;

  /**
   * @param  {string} vaultId
   * @param  {WhitelistConfig} config
   * @returns Promise with corresponding transaction id
   */
  public async create(
    vaultId: string,
    config: WhitelistConfig,
  ): Promise<{ transactionId: string }> {
    const { id } = await this.api.createWhitelist(vaultId, config.type, config.token, config.capacity, config.access);
    return { transactionId: id };
  }

  /**
   * @param  {string} vaultId
   * @param  {string} externalAddress
   * @param  {string} signature
   * @returns Promise with boolean result
   */
  public async join(vaultId: string, externalAddress: string, signature: string): Promise<boolean> {
    return await this.api.joinWhitelist(vaultId, externalAddress, signature);
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding vault whitelist
   */
  public async get(vaultId: string): Promise<Whitelist> {
    return await this.api.getWhitelist(vaultId);
  }

  /**
   * @param  {ListOptions} options
   * @returns Promise with paginated user whitelists
   */
  public async list(options: ListOptions = {}): Promise<Paginated<Whitelist>> {
    const response = await this.api.getWhitelists(options);
    return {
      items: response.items,
      nextToken: response.nextToken
    }
  }

  /**
   * @param  {ListOptions} options
   * @returns Promise with all user whitelists
   */
  public async listAll(options: ListOptions = {}): Promise<Array<Whitelist>> {
    const list = async (listOptions: ListOptions) => {
      return await this.list(listOptions);
    }
    return await paginate<Whitelist>(list, options);
  }
};

export {
  WhitelistService
}
