import { reactionEmoji, actionRefs, functions } from "../constants";
import lodash from "lodash";
import { Memo, MemoCreateResult, MemoReaction, MemoUpdateResult, MemoVersion } from "../types/memo";
import { nodeType, NodeCreateOptions } from "../types/node";
import { ListOptions } from "../types/query-options";
import { NotFound } from "../errors/not-found";
import { EncryptedKeys } from "@akord/crypto";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";
import { NodeModule } from "./node";
import { Wallet } from "@akord/crypto";
import { Api } from "../api/api";
import { Service } from ".";

class MemoModule extends NodeModule<Memo> {
  static readonly reactionEmoji = reactionEmoji;

  constructor(wallet: Wallet, api: Api, service?: Service) {
    super(wallet, api, Memo, nodeType.MEMO, service);
    this.service.defaultListOptions = {
      shouldDecrypt: true,
      filter: {}
    } as ListOptions;
  }

  /**
   * @param  {string} vaultId
   * @param  {string} message
   * @param  {NodeCreateOptions} [options] parent id, etc.
   * @returns Promise with new node id & corresponding transaction id
   */
  public async create(vaultId: string, message: string, options: NodeCreateOptions = this.defaultCreateOptions): Promise<MemoCreateResult> {
    await this.service.setVaultContext(vaultId);
    this.service.setActionRef(actionRefs.MEMO_CREATE);
    this.service.setFunction(functions.NODE_CREATE);
    this.service.setAkordTags(options.tags);
    const state = {
      versions: [await this.memoVersion(message)],
      tags: options.tags || []
    };
    const { nodeId, transactionId, object } = await this.service.nodeCreate<Memo>(state, { parentId: options.parentId }, options.arweaveTags);
    return { memoId: nodeId, transactionId, object };
  }

  /**
   * @param  {string} memoId
   * @param  {reactionEmoji} reaction
   * @returns Promise with corresponding transaction id
   */
  public async addReaction(memoId: string, reaction: reactionEmoji): Promise<MemoUpdateResult> {
    await this.service.setVaultContextFromNodeId(memoId, this.objectType);
    this.service.setActionRef(actionRefs.MEMO_ADD_REACTION);
    this.service.setFunction(functions.NODE_UPDATE);
    this.service.arweaveTags = await this.service.getTxTags();

    const currentState = await this.service.getCurrentState();
    const newState = lodash.cloneDeepWith(currentState);
    newState.versions[newState.versions.length - 1].reactions.push(await this.memoReaction(reaction));
    const dataTxId = await this.service.uploadState(newState, this.service.vault.cloud);

    const { id, object } = await this.service.api.postContractTransaction<Memo>(
      this.service.vaultId,
      { function: this.service.function, data: dataTxId },
      this.service.arweaveTags
    );
    const memo = await this.processMemo(object, !this.service.isPublic, this.service.keys);
    return { transactionId: id, object: memo };
  }

  /**
   * @param  {string} memoId
   * @param  {reactionEmoji} reaction
   * @returns Promise with corresponding transaction id
   */
  public async removeReaction(memoId: string, reaction: reactionEmoji): Promise<MemoUpdateResult> {
    await this.service.setVaultContextFromNodeId(memoId, this.objectType);
    this.service.setActionRef(actionRefs.MEMO_REMOVE_REACTION);
    this.service.setFunction(functions.NODE_UPDATE);
    this.service.arweaveTags = await this.service.getTxTags();

    const state = await this.deleteReaction(reaction);
    const dataTxId = await this.service.uploadState(state, this.service.vault.cloud);

    const { id, object } = await this.service.api.postContractTransaction<Memo>(
      this.service.vaultId,
      { function: this.service.function, data: dataTxId },
      this.service.arweaveTags
    );
    const memo = await this.processMemo(object, !this.service.isPublic, this.service.keys);
    return { transactionId: id, object: memo };
  }

  protected async processMemo(object: Memo, shouldDecrypt: boolean, keys?: EncryptedKeys[]): Promise<Memo> {
    const memo = new Memo(object, keys);
    if (shouldDecrypt) {
      try {
        await memo.decrypt();
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
    return memo;
  }

  private async memoVersion(message: string): Promise<MemoVersion> {
    const version = {
      owner: await this.service.wallet.getAddress(),
      message: await this.service.processWriteString(message),
      createdAt: JSON.stringify(Date.now()),
      reactions: []
    };
    return new MemoVersion(version);
  }

  private async memoReaction(reactionEmoji: reactionEmoji): Promise<MemoReaction> {
    const reaction = {
      reaction: await this.service.processWriteString(reactionEmoji),
      owner: await this.service.wallet.getAddress(),
      createdAt: JSON.stringify(Date.now())
    };
    return new MemoReaction(reaction);
  }

  private async deleteReaction(reaction: string) {
    const currentState = await this.service.getCurrentState();
    const index = await this.getReactionIndex(currentState.versions[currentState.versions.length - 1].reactions, reaction);
    const newState = lodash.cloneDeepWith(currentState);
    newState.versions[newState.versions.length - 1].reactions.splice(index, 1);
    return newState;
  }

  private async getReactionIndex(reactions: MemoReaction[], reaction: string) {
    const address = await this.service.wallet.getAddress();
    for (const [key, value] of Object.entries(reactions)) {
      if (value.owner === address && reaction === await this.service.processReadString(value.reaction)) {
        return key;
      }
    }
    throw new NotFound("Could not find reaction: " + reaction + " for given user.")
  }
};

export {
  MemoModule
}