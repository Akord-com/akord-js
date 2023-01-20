import { NodeService } from "./node";
import { reactionEmoji, actionRefs, objectTypes, functions } from "../constants";
import lodash from "lodash";
import { Memo, MemoReaction, MemoVersion } from "../types/node";

class MemoService extends NodeService<Memo> {
  static readonly reactionEmoji = reactionEmoji;

  objectType: string = objectTypes.MEMO;
  NodeType = Memo;

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
    this.setFunction(functions.NODE_CREATE);
    const body = {
      versions: [await this.memoVersion(message)]
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
    this.setActionRef(actionRefs.MEMO_ADD_REACTION);
    this.setFunction(functions.NODE_UPDATE);
    this.tags = await this.getTags();

    const currentState = await this.api.getNodeState(this.object.data[this.object.data.length - 1]);
    const newState = lodash.cloneDeepWith(currentState);
    newState.versions[newState.versions.length -1].reactions.push(await this.memoReaction(reaction));
    const { data, metadata } = await this.uploadState(newState);

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      { function: this.function, data },
      this.tags,
      metadata
    );
    return { transactionId: txId }
  }

  /**
   * @param  {string} memoId
   * @param  {reactionEmoji} reaction
   * @returns Promise with corresponding transaction id
   */
  public async removeReaction(memoId: string, reaction: reactionEmoji): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(memoId, this.objectType);
    this.setActionRef(actionRefs.MEMO_REMOVE_REACTION);
    this.setFunction(functions.NODE_UPDATE);
    this.tags = await this.getTags();

    const body = await this.deleteReaction(reaction);
    const { data, metadata } = await this.uploadState(body);

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      { function: this.function, data },
      this.tags,
      metadata
    );
    return { transactionId: txId }
  }

  // TODO: return type Promise<MemoVersion>
  private async memoVersion(message: string): Promise<any> {
    const version = {
      owner: await this.wallet.getAddress(),
      message: await this.processWriteString(message),
      createdAt: JSON.stringify(Date.now()),
      reactions: [],
      attachments: []
    };
    return version;
  }

  // TODO: return type Promise<MemoReaction>
  private async memoReaction(reactionEmoji: reactionEmoji): Promise<any> {
    const reaction = {
      reaction: await this.processWriteString(reactionEmoji),
      owner: await this.wallet.getAddress(),
      createdAt: JSON.stringify(Date.now())
    };
    return reaction;
  }

  private async deleteReaction(reaction: string) {
    const currentState = await this.api.getNodeState(this.object.data[this.object.data.length - 1]);
    const index = await this.getReactionIndex(currentState.versions[currentState.versions.length -1].reactions, reaction);
    const newState = lodash.cloneDeepWith(currentState);
    newState.versions[newState.versions.length -1].reactions.splice(index, 1);
    return newState;
  }

  private async getReactionIndex(reactions: any[], reaction: string) {
    const address = await this.wallet.getAddress();
    const publicSigningKey = await this.wallet.signingPublicKey();
    for (const [key, value] of Object.entries(reactions)) {
      if ((value.owner === address || value.address === address || value.publicSigningKey === publicSigningKey)
        && reaction === await this.processReadString(value.reaction)) {
        return key;
      }
    }
    throw new Error("Could not find reaction: " + reaction + " for given user.")
  }
};

export {
  MemoService
}