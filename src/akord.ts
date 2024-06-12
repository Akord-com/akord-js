import { Api } from "./api/api";
import { AkordApi } from "./api/akord-api";
import { ClientConfig } from "./config";
import { Crypto, Encrypter, Wallet } from "@akord/crypto";
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
import { Signer } from "./signer";

export class Akord {
  static readonly reactionEmoji = reactionEmoji;

  public api: Api;
  private signer: Signer;
  private encrypter: Encrypter;
  private env: 'dev' | 'v2';
  private userAgent: string;

  public static init: (wallet: Wallet, config?: ClientConfig) => Promise<Akord>;

  get memo(): MemoModule {
    return new MemoModule(this.getConfig());
  }
  get folder(): FolderModule {
    return new FolderModule(this.getConfig());
  }
  get membership(): MembershipModule {
    return new MembershipModule(this.getConfig());
  }
  get vault(): VaultModule {
    return new VaultModule(this.getConfig());
  }
  get stack(): StackModule {
    return new StackModule(this.getConfig());
  }
  get note(): NoteModule {
    return new NoteModule(this.getConfig());
  }
  get manifest(): ManifestModule {
    return new ManifestModule(this.getConfig());
  }
  get profile(): ProfileModule {
    return new ProfileModule(this.getConfig());
  }
  get batch(): BatchModule {
    return new BatchModule(this.getConfig());
  }
  get contract(): ContractModule {
    return new ContractModule(this.getConfig());
  }
  get nft(): NFTModule {
    return new NFTModule(this.getConfig());
  }
  get collection(): CollectionModule {
    return new CollectionModule(this.getConfig());
  }
  get file(): FileModule {
    return new FileModule(this.getConfig());
  }
  get zip(): ZipModule {
    return new ZipModule(this.getConfig());
  }

  private getConfig() {
    return {
      api: this.api,
      signer: this.signer,
      encrypter: this.encrypter,
      userAgent: this.userAgent
    }
  }

  /**
   * @param  {ClientConfig} config
   * @param  {LegacyConfig} [config]
   */
  constructor(config: ClientConfig | Wallet = {}, legacyConfig: ClientConfig = {}) {
    let clientConfig: ClientConfig, encrypter: Wallet;
    // deprecated (legacy constructor)
    if (typeof (<Wallet>config)?.getAddress === 'function') {
      clientConfig = legacyConfig;
      this.signer = config as Wallet;
      encrypter = config as Wallet;
    } else {
      clientConfig = config as ClientConfig;
      this.signer = clientConfig?.signer;
      encrypter = clientConfig?.encrypter;
    }
    this.encrypter = encrypter ? new Encrypter(encrypter, null, null) : null;
    this.env = clientConfig?.env || 'v2';
    this.api = clientConfig?.api ? clientConfig.api : new AkordApi(clientConfig);
    this.userAgent = clientConfig?.userAgent;
    Crypto.configure({ wallet: encrypter });
    Plugins.register(clientConfig?.plugins, this.env);
    Logger.debug = clientConfig?.debug;
    CacheBusters.cache = clientConfig?.cache;
  }
}
