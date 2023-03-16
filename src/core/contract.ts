import { Service } from "../core";
import { ContractState, Tags } from "../types/contract";
import { Transaction } from "../types/transaction";

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
    const contract = await this.api.getContractState(id);
    this.setIsPublic(contract.public);
    if (contract.public) {
      return contract;
    } else {
      await contract.decrypt();
    }
    return contract;
  }

  /**
   * @param  id vault contract id
   * @returns Promise with the list of all contract interactions
   */
  public async list(id: string): Promise<Array<Transaction>> {
    return this.api.getTransactions(id);
  }
}

export {
  ContractService
}
