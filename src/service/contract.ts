import { Service } from "../service";
import { Contract } from "../types/contract";

class ContractService extends Service {
  /**
   * @param  id vault contract id
   * @returns Promise with the current contract state
   */
  public async getState(id: string): Promise<Contract> {
    const contract = await this.api.getContractState(id);
    this.setIsPublic(contract.state.isPublic);
    // if private vault, set encryption context
    await this.setMembershipKeys(id);
    contract.state = await this.processState(contract.state);
    if (contract.state.memberships) {
      await Promise.all(contract.state.memberships.map(async (membership) => await this.processState(membership)));
    }
    await Promise.all(contract.state.memos.map(async (memo) => await this.processState(memo)));
    await Promise.all(contract.state.folders.map(async (folder) => await this.processState(folder)));
    await Promise.all(contract.state.stacks.map(async (stack) => await this.processState(stack)));
    await Promise.all(contract.state.notes.map(async (note) => await this.processState(note)));
    return contract;
  }
}

export {
  ContractService
}
