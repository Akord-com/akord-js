import { Api, ApiFactory } from "./api";
import { ClientConfig } from "./client-config";
import { Service } from "./service";
import { Wallet } from "@akord/crypto";
import { reactionEmoji } from "./constants";
import { Logger } from "./logger";
import { MemoService } from "./service/memo";
import { FolderService } from "./service/folder";
import { MembershipService } from "./service/membership";
import { VaultService } from "./service/vault";
import { StackService } from "./service/stack";
import { NoteService } from "./service/note";
import { ProfileService } from "./service/profile";
import { Contract } from "./model/contract";
import { Auth } from "./auth";
import { CacheBusters } from "./model/cacheable";
import { FileService } from "./service/file";
import { BatchService } from "./service/batch";

export class Akord {
  static readonly reactionEmoji = reactionEmoji;

  public api: Api;
  public memo: MemoService;
  public folder: FolderService;
  public membership: MembershipService;
  public vault: VaultService;
  public stack: StackService;
  public file: FileService;
  public note: NoteService;
  public profile: ProfileService;
  public batch: BatchService;
  public service: Service;

  public static init: (wallet: Wallet, jwtToken?: string, apiConfig?: ClientConfig) => Promise<Akord>;
  public static auth = new Auth();

  // TODO: JWT token provider
  /**
   * @param  {ClientConfig} config
   * @param  {Wallet} [wallet]
   * @param  {string} [jwtToken]
   */
  constructor(wallet?: Wallet, jwtToken?: string, config: ClientConfig = {}) {
    Logger.debug = config.debug;
    CacheBusters.cache = config.cache
    this.api = new ApiFactory(config, wallet, jwtToken).apiInstance();
    this.service = new Service(wallet, this.api);
    this.vault = new VaultService(wallet, this.api);
    this.memo = new MemoService(wallet, this.api);
    this.folder = new FolderService(wallet, this.api);
    this.stack = new StackService(wallet, this.api);
    this.note = new NoteService(wallet, this.api);
    this.membership = new MembershipService(wallet, this.api);
    this.profile = new ProfileService(wallet, this.api);
    this.batch = new BatchService(wallet, this.api);
  }

  public async getContractState(id: string): Promise<Contract> {
    const contract = await this.api.getContractState(id);
    this.service.setIsPublic(contract.state.isPublic);
    // if private vault, set encryption context
    if (!this.service.isPublic) {
      const encryptionKeys = await this.api.getMembershipKeys(id, this.service.wallet);
      const keys = encryptionKeys.keys.map(((keyPair: any) => {
        return {
          encPrivateKey: keyPair.encPrivateKey,
          publicKey: keyPair.publicKey ? keyPair.publicKey : keyPair.encPublicKey
        }
      }))
      this.service.setKeys(keys);
      (<any>this.service).setRawDataEncryptionPublicKey(encryptionKeys?.getPublicKey());
    }
    contract.state = await this.service.decryptState(contract.state);
    if (contract.state.memberships) {
      await Promise.all(contract.state.memberships.map(async (membership) => await this.service.decryptState(membership)));
    }
    await Promise.all(contract.state.memos.map(async (memo) => await this.service.decryptState(memo)));
    await Promise.all(contract.state.folders.map(async (folder) => await this.service.decryptState(folder)));
    await Promise.all(contract.state.stacks.map(async (stack) => await this.service.decryptState(stack)));
    await Promise.all(contract.state.notes.map(async (note) => await this.service.decryptState(note)));
    return contract;
  }
}