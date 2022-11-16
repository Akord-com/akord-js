import { Api, ApiFactory } from "./api";
import { ClientConfig } from "./client-config";
import { Crypto, Wallet } from "@akord/crypto";
import { reactionEmoji } from "./constants";
import { Logger } from "./logger";
import { MemoService } from "./core/memo";
import { FolderService } from "./core/folder";
import { MembershipService } from "./core/membership";
import { VaultService } from "./core/vault";
import { StackService } from "./core/stack";
import { NoteService } from "./core/note";
import { ProfileService } from "./core/profile";
import { Auth } from "./auth";
import { CacheBusters } from "./types/cacheable";
import { FileService } from "./core/file";
import { BatchService } from "./core/batch";
import { ContractService } from "./core/contract";

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
  public contract: ContractService;

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
    CacheBusters.cache = config.cache;
    Crypto.configure({ wallet: wallet });
    this.api = new ApiFactory(config, wallet, jwtToken).apiInstance();
    this.vault = new VaultService(wallet, this.api);
    this.memo = new MemoService(wallet, this.api);
    this.folder = new FolderService(wallet, this.api);
    this.stack = new StackService(wallet, this.api);
    this.file = new FileService(wallet, this.api);
    this.note = new NoteService(wallet, this.api);
    this.membership = new MembershipService(wallet, this.api);
    this.profile = new ProfileService(wallet, this.api);
    this.batch = new BatchService(wallet, this.api);
    this.contract = new ContractService(wallet, this.api);
  }
}
