import { Service } from "../service";
import { ContractState } from "../types/contract";

class ContractService extends Service {
  /**
   * @param  id vault contract id
   * @returns Promise with the current contract state
   */
  public async getState(id: string): Promise<ContractState> {
    let contractState = await this.api.getContractState(id);
    this.setIsPublic(contractState.public);
    // if private vault, set encryption context
    await this.setMembershipKeys(id);
    contractState = await this.processState(contractState);
    if (contractState.memberships) {
      await Promise.all(contractState.memberships.map(async (membership) => await this.processState(membership)));
    }
    await Promise.all(contractState.memos.map(async (memo) => await this.processState(memo)));
    await Promise.all(contractState.folders.map(async (folder) => await this.processState(folder)));
    await Promise.all(contractState.stacks.map(async (stack) => await this.processState(stack)));
    await Promise.all(contractState.notes.map(async (note) => await this.processState(note)));
    return contractState;
  }
}

export {
  ContractService
}
