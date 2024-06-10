import { Api } from "./api/api";
import { AkordApi } from "./api/akord-api";
import { ClientConfig } from "./config";
import { Crypto, Wallet } from "@akord/crypto";
import { reactionEmoji } from "./constants";
import { Logger } from "./logger";
import { MemoModule } from "./core/memo";
import { FolderModule } from "./core/folder";
import { MembershipModule } from "./core/membership";
import { VaultModule } from "./core/vault";
import { StackModule } from "./core/stack";
import { NoteModule } from "./core/note";
import { ManifestModule } from "./core/manifest";
import { ProfileModule } from "./core/profile";
import { CacheBusters } from "./types/cacheable";
import { BatchModule } from "./core/batch";
import { ContractModule } from "./core/contract";
import { NFTModule } from "./core/nft";
import { CollectionModule } from "./core/collection";
import { ZipModule } from "./core/zip";
import { FileModule } from "./core/file";
import { Plugins } from "./plugin";
import { StorageModule } from "./core/storage";

export class Akord {
  static readonly reactionEmoji = reactionEmoji;

  public api: Api;
  private wallet: Wallet;
  private env: 'dev' | 'v2';

  public static init: (wallet: Wallet, config?: ClientConfig) => Promise<Akord>;

  get memo(): MemoModule {
    return new MemoModule(this.wallet, this.api);
  }
  get folder(): FolderModule {
    return new FolderModule(this.wallet, this.api);
  }
  get membership(): MembershipModule {
    return new MembershipModule(this.wallet, this.api);
  }
  get vault(): VaultModule {
    return new VaultModule(this.wallet, this.api);
  }
  get stack(): StackModule {
    return new StackModule(this.wallet, this.api);
  }
  get note(): NoteModule {
    return new NoteModule(this.wallet, this.api);
  }
  get manifest(): ManifestModule {
    return new ManifestModule(this.wallet, this.api);
  }
  get profile(): ProfileModule {
    return new ProfileModule(this.wallet, this.api);
  }
  get batch(): BatchModule {
    return new BatchModule(this.wallet, this.api);
  }
  get contract(): ContractModule {
    return new ContractModule(this.wallet, this.api);
  }
  get nft(): NFTModule {
    return new NFTModule(this.wallet, this.api);
  }
  get collection(): CollectionModule {
    return new CollectionModule(this.wallet, this.api);
  }
  get file(): FileModule {
    return new FileModule(this.wallet, this.api);
  }
  get zip(): ZipModule {
    return new ZipModule(this.wallet, this.api);
  }
  get storage(): StorageModule {
    return new StorageModule(this.wallet, this.api);
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
