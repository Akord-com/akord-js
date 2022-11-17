import { Service } from "../core";
import { ContractState, Tags } from "../types/contract";

class ContractService extends Service {

  /**
   * @param tags array of name#value tags of warp contract to be created
   * @param state initial state of warp contract
   * @returns Promise contract Id
   */
  public async create(tags: Tags, state?: any): Promise<string> {
    return await this.api.initContractId(tags, state)
  }

  /**
   * @param  id vault contract id
   * @returns Promise with the current contract state
   */
  public async getState(id: string): Promise<ContractState> {
    const { isEncrypted, keys } = await this.api.getMembershipKeys(id, this.wallet);
    const contractState = await this.api.getContractState(id);
    contractState.__keys__ = keys;
    if (isEncrypted) {
      await contractState.decrypt();
    }
    return contractState;
  }

  /**
   * @param  id vault contract id
   * @returns Promise with the list of all contract interactions
   */
  public async list(id: string): Promise<Array<any>> {
    return this.api.getTransactions(id);
  }
}

export {
  ContractService
}