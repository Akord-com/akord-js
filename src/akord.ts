import { Api } from "./api/api";
import { AkordApi } from "./api/akord-api";
import { ClientConfig } from "./config";
import { Crypto, Wallet } from "@akord/crypto";
import { reactionEmoji } from "./constants";
import { Logger } from "./logger";
import { MemoService } from "./core/memo";
import { FolderService } from "./core/folder";
import { MembershipService } from "./core/membership";
import { VaultService } from "./core/vault";
import { StackService } from "./core/stack";
import { NoteService } from "./core/note";
import { ManifestService } from "./core/manifest";
import { ProfileService } from "./core/profile";
import { CacheBusters } from "./types/cacheable";
import { BatchService } from "./core/batch";
import { ContractService } from "./core/contract";
import { NFTService } from "./core/nft";
import { CollectionService } from "./core/collection";
import { ZipService } from "./core/zip";
import { FileService } from "./core/file";
import { Plugins } from "./plugin";

export class Akord {
  static readonly reactionEmoji = reactionEmoji;

  public api: Api;
  public wallet: Wallet;
  public env: 'dev' | 'v2';

  public static init: (wallet: Wallet, config?: ClientConfig) => Promise<Akord>;

  get memo(): MemoService {
    return new MemoService(this.wallet, this.api);
  }
  get folder(): FolderService {
    return new FolderService(this.wallet, this.api);
  }
  get membership(): MembershipService {
    return new MembershipService(this.wallet, this.api);
  }
  get vault(): VaultService {
    return new VaultService(this.wallet, this.api);
  }
  get stack(): StackService {
    return new StackService(this.wallet, this.api);
  }
  get note(): NoteService {
    return new NoteService(this.wallet, this.api);
  }
  get manifest(): ManifestService {
    return new ManifestService(this.wallet, this.api);
  }
  get profile(): ProfileService {
    return new ProfileService(this.wallet, this.api);
  }
  get batch(): BatchService {
    return new BatchService(this.wallet, this.api);
  }
  get contract(): ContractService {
    return new ContractService(this.wallet, this.api);
  }
  get nft(): NFTService {
    return new NFTService(this.wallet, this.api);
  }
  get collection(): CollectionService {
    return new CollectionService(this.wallet, this.api);
  }
  get file(): FileService {
    return new FileService(this.wallet, this.api);
  }
  get zip(): ZipService {
    return new ZipService(this.wallet, this.api);
  }

  /**
   * @param  {ClientConfig} config
   * @param  {Wallet} [wallet]
   */
  constructor(wallet?: Wallet, config: ClientConfig = {}) {
    this.api = config.api ? config.api : new AkordApi(config);
    this.wallet = wallet;
    this.env = config.env || 'v2';
    Crypto.configure({ wallet: wallet });
    Plugins.register(config.plugins, this.env);
    Logger.debug = config.debug;
    CacheBusters.cache = config.cache;
  }
}
