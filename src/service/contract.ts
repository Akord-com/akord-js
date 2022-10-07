import { Service } from "../service";
import { Contract } from "../model/contract";

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
    contract.state = await this.decryptState(contract.state);
    if (contract.state.memberships) {
      await Promise.all(contract.state.memberships.map(async (membership) => await this.decryptState(membership)));
    }
    await Promise.all(contract.state.memos.map(async (memo) => await this.decryptState(memo)));
    await Promise.all(contract.state.folders.map(async (folder) => await this.decryptState(folder)));
    await Promise.all(contract.state.stacks.map(async (stack) => await this.decryptState(stack)));
    await Promise.all(contract.state.notes.map(async (note) => await this.decryptState(note)));
    return contract;
  }
}

export {
  ContractService
}