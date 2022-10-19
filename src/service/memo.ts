import { NodeService } from "./node";
import { reactionEmoji, actionRefs, objectTypes, commands } from "../constants";
import lodash from "lodash";

class MemoService extends NodeService {
  objectType: string = objectTypes.MEMO;

  /**
  * @param  {string} vaultId
  * @param  {string} message 
  * @returns Promise with new node id & corresponding transaction id
  */
  public async create(vaultId: string, message: string): Promise<{
    memoId: string,
    transactionId: string
  }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.MEMO_CREATE);
    this.setCommand(commands.NODE_CREATE);
    const body = {
      message: await this.processWriteString(message)
    };
    const { nodeId, transactionId } = await this.nodeCreate(body);
    return { memoId: nodeId, transactionId };
  }

  /**
  * @param  {string} memoId
  * @param  {reactionEmoji} reaction
  * @returns Promise with corresponding transaction id
  */
  public async addReaction(memoId: string, reaction: reactionEmoji): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(memoId, this.objectType);
    const memberDetails = await this.getProfileDetails();
    this.setActionRef(actionRefs.MEMO_ADD_REACTION);
    const body = {
      reactions: [{
        reaction: await this.processWriteString(reaction),
        owner: await this.wallet.getAddress(),
        status: "ACTIVE",
        createdAt: JSON.stringify(Date.now())
      }]
    };
    this.setCommand(commands.NODE_UPDATE);
    return this.nodeUpdate(body);
  }

  /**
   * @param  {string} memoId
   * @param  {reactionEmoji} reaction
   * @returns Promise with corresponding transaction id
   */
  public async removeReaction(memoId: string, reaction: reactionEmoji): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(memoId, this.objectType);
    this.setActionRef(actionRefs.MEMO_REMOVE_REACTION);
    this.setCommand(commands.NODE_UPDATE);
    this.tags = await this.getTags();

    const body = await this.deleteReaction(reaction);
    const { data, metadata } = await this._uploadBody(body);

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      { function: this.command, data },
      this.tags,
      { ...metadata, ...this.metadata() }
    );
    return { transactionId: txId }
  }

  private async deleteReaction(reaction: string) {
    const currentState = await this.api.getNodeState(this.objectId, this.objectType, this.vaultId);
    const index = await this.getReactionIndex(currentState.reactions, reaction);
    const newState = lodash.cloneDeepWith(currentState);
    newState.reactions.splice(index, 1);
    return newState;
  }

  private async getReactionIndex(reactions: any[], reaction: string) {
    const address = await this.wallet.getAddress();
    const publicSigningKey = await this.wallet.signingPublicKey();
    for (const [key, value] of Object.entries(reactions)) {
      if ((<any>value).status === 'ACTIVE'
        && ((<any>value).owner === address || (<any>value).address === address || (<any>value).publicSigningKey === publicSigningKey)
        && reaction === await this.processReadString((<any>value).reaction)) {
        return <any>(<unknown>key);
      }
    }
    throw new Error("Could not find reaction: " + reaction + " for given user.")
  }
};

export {
  MemoService
}