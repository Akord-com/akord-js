import { Api, ApiFactory, AkordApi } from "./api";
import { ClientConfig } from "./client-config";
import { Service, ServiceFactory } from "./service";
import { Wallet } from "@akord/crypto";
import { reactionEmoji, objectTypes } from "./constants";
import { v4 as uuidv4 } from "uuid";
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

export class Akord {
  static readonly reactionEmoji = reactionEmoji;

  public api: Api;
  public memo: MemoService;
  public folder: FolderService;
  public membership: MembershipService;
  public vault: VaultService;
  public stack: StackService;
  public note: NoteService;
  public profile: ProfileService;
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
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async batchRevoke(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    return this.batchAction(items, "REVOKE");
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async batchRestore(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    return this.batchAction(items, "RESTORE");
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async batchDelete(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    return this.batchAction(items, "DELETE");
  }

  /**
   * @param  {{id:string,objectType:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async batchMove(items: { id: string, objectType: string }[], parentId?: string): Promise<{ transactionId: string }[]> {
    return this.batchAction(items, "MOVE", parentId);
  }

  /**
   * @param  {{id:string,role:string}[]} items
   * @returns Promise with corresponding transaction ids
   */
  public async batchMembershipChangeRole(items: { id: string, role: string }[]): Promise<{ transactionId: string }[]> {
    const groupRef = items && items.length > 1 ? uuidv4() : null;

    const response = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new MembershipService(this.service.wallet, this.api);
      service.setGroupRef(groupRef);
      response.push(await service.changeRole(item.id, item.role));
    }));
    return response;
  }

  /**
   * @param  {string} vaultId
   * @param  {{file:any,name:string}[]} items
   * @param  {string} [parentId]
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with new stack ids & their corresponding transaction ids
   */
  public async batchStackCreate(
    vaultId: string,
    items: { file: any, name: string }[],
    parentId?: string,
    progressHook?: (progress: number) => void,
    cancelHook?: AbortController
  ): Promise<{
    stackId: string,
    transactionId: string
  }[]> {
    const groupRef = items && items.length > 1 ? uuidv4() : null;

    const vault = await this.api.getObject(vaultId, objectTypes.VAULT);
    let encryptionKeys = {} as any;
    if (!vault.state?.isPublic) {
      encryptionKeys = await this.api.getMembershipKeys(vaultId, this.service.wallet);
    }
    const response = [] as { stackId: string, transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new StackService(this.service.wallet, this.api);
      service.setGroupRef(groupRef);
      response.push(await service.create(vaultId, item.file, item.name, parentId, progressHook, cancelHook));
    }));
    return response;
  }

  /**
   * @param  {string} vaultId
   * @param  {{email:string,role:string}[]} items
   * @returns Promise with new membership ids & their corresponding transaction ids
   */
  public async batchMembershipInvite(vaultId: string, items: { email: string, role: string }[]): Promise<{
    membershipId: string,
    transactionId: string
  }[]> {
    const groupRef = items && items.length > 1 ? uuidv4() : null;
    const emails = items.reduce((accumulator, currentValue) => {
      accumulator.push(currentValue.email);
      return accumulator;
    }, []);
    const results = await this.api.preInviteCheck(emails, vaultId);
    const response = [] as { membershipId: string, transactionId: string }[];

    await Promise.all(items.map(async (item, index) => {
      if (results[index].membership) {
        throw new Error("Membership already exists for this user.");
      }
      const { email, role } = item;
      const userHasAccount = results[index].publicKey;
      const service = new MembershipService(this.service.wallet, this.api);
      service.setGroupRef(groupRef);
      if (userHasAccount) {
        response.push(await service.invite(vaultId, email, role));
      } else {
        response.push(await service.inviteNewUser(vaultId, email, role));
      }
    }));
    return response;
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
    contract.state = await this.service.processState(contract.state);
    if (contract.state.memberships) {
      await Promise.all(contract.state.memberships.map(async (membership) => await this.service.processState(membership)));
    }
    await Promise.all(contract.state.memos.map(async (memo) => await this.service.processState(memo)));
    await Promise.all(contract.state.folders.map(async (folder) => await this.service.processState(folder)));
    await Promise.all(contract.state.stacks.map(async (stack) => await this.service.processState(stack)));
    await Promise.all(contract.state.notes.map(async (note) => await this.service.processState(note)));
    return contract;
  }

  /**
   * @param  {string} id file resource url
   * @param  {string} vaultId
   * @param  {boolean} [isChunked]
   * @param  {number} [numberOfChunks]
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with file buffer
   */
  public async getFile(id: string, vaultId: string, isChunked?: boolean, numberOfChunks?: number, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<ArrayBuffer> {
    const service = await this.setVaultContext(vaultId);
    let fileBinary
    if (isChunked) {
      let currentChunk = 0;
      try {
        while (currentChunk < numberOfChunks) {
          const url = `${id}_${currentChunk}`;
          const file = await this.api.downloadFile(url, service.isPublic, progressHook, cancelHook);
          const fileData = await service.processReadRaw(file.fileData, file.headers)
          fileBinary = this.appendBuffer(fileBinary, fileData);
          currentChunk++;
        }
      } catch (e) {
        Logger.log(e);
        throw new Error(
          "Failed to download. Please check your network connection." +
          " Please upload the file again if problem persists and/or contact Akord support."
        );
      }
    } else {
      const file = await this.api.downloadFile(id, service.isPublic, progressHook, cancelHook);
      fileBinary = await service.processReadRaw(file.fileData, file.headers)
    }
    return fileBinary;
  }

  /**
   * @param  {string} id file resource url
   * @param  {boolean} [isChunked]
   * @param  {number} [numberOfChunks]
   * @param  {(progress:number)=>void} [progressHook]
   * @param  {AbortController} [cancelHook]
   * @returns Promise with file buffer
   */
  public async getPublicFile(id: string, isChunked?: boolean, numberOfChunks?: number, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<ArrayBuffer> {
    this.service.setIsPublic(true);
    let fileBinary
    if (isChunked) {
      let currentChunk = 0;
      try {
        while (currentChunk < numberOfChunks) {
          const url = `${id}_${currentChunk}`;
          const file = await this.api.downloadFile(url, true, progressHook, cancelHook);
          const fileData = await this.service.processReadRaw(file.fileData, file.headers)
          fileBinary = this.appendBuffer(fileBinary, fileData);
          currentChunk++;
        }
      } catch (e) {
        Logger.log(e);
        throw new Error(
          "Failed to download. Please check your network connection." +
          " Please upload the file again if problem persists and/or contact Akord support."
        );
      }
    } else {
      const file = await this.api.downloadFile(id, true, progressHook, cancelHook);
      fileBinary = await this.service.processReadRaw(file.fileData, file.headers)
    }
    return fileBinary;
  }

  private async batchAction(
    items: { id: string, objectType: string, role?: string }[],
    actionType: string,
    parentId?: string,
  ): Promise<{ transactionId: string }[]> {
    const groupRef = items && items.length > 1 ? uuidv4() : null;
    const vaultId = (await this.api.getObject(items[0].id, items[0].objectType)).dataRoomId;
    const vault = await this.api.getObject(vaultId, objectTypes.VAULT);
    let encryptionKeys = {} as any;
    if (!vault.state?.isPublic) {
      encryptionKeys = await this.api.getMembershipKeys(vaultId, this.service.wallet);
    }
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(this.service.wallet, this.api, item.objectType).serviceInstance();
      service.setGroupRef(groupRef);
      switch (actionType) {
        case "REVOKE":
          transactionIds.push(await service.revoke(item.id));
          break;
        case "RESTORE":
          transactionIds.push(await service.restore(item.id));
          break;
        case "MOVE":
          transactionIds.push(await service.move(item.id, parentId));
          break;
        case "DELETE":
          transactionIds.push(await service.delete(item.id));
          break;
        default:
          break;
      }
    }));
    return transactionIds;
  }

  private async setVaultContext(vaultId: string) {
    const vault = await this.api.getObject(vaultId, objectTypes.VAULT);
    const service = new Service(this.service.wallet, this.api);
    service.setVault(vault);
    service.setVaultId(vaultId);
    service.setIsPublic(vault.state?.isPublic);
    if (!service.isPublic) {
      const encryptionKeys = await this.api.getMembershipKeys(vaultId, this.service.wallet);
      service.setKeys(encryptionKeys.keys);
      (<any>service).setRawDataEncryptionPublicKey(encryptionKeys?.getPublicKey());
    }
    return service;
  }

  private appendBuffer(buffer1: Uint8Array, buffer2: Uint8Array): ArrayBufferLike {
    if (!buffer1 && !buffer2) return;
    if (!buffer1) return buffer2;
    if (!buffer2) return buffer1;
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  }
}