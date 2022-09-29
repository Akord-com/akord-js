import { Api, ApiFactory } from "./api";
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

export default class Akord {
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
  public static auth: Auth;

  // TODO: JWT token provider
  /**
   * @param  {ClientConfig} config
   * @param  {Wallet} [wallet]
   * @param  {string} [jwtToken]
   */
  constructor(wallet?: Wallet, jwtToken?: string, config: ClientConfig = {}) {
    Logger.debug = config.debug;
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
    const vault = await this.api.getObject(vaultId, objectTypes.VAULT);
    let encryptionKeys = {} as any;
    if (!vault.state?.isPublic) {
      encryptionKeys = await this.api.getMembershipKeys(vaultId, this.service.wallet);
    }
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

  /**
   * @returns Promise with profile details
   */
  public async getProfileDetails(): Promise<any> {
    return await this.service.getProfileDetails();
  }

  /**
   * @returns Promise with user vaults array
   */
  public async getVaults(): Promise<{ id: string, name: string }[]> {
    const vaults = await this.api.getVaults(this.service.wallet);
    let vaultTable = [];
    for (let vault of vaults) {
      const decryptedState = await this.decryptNode(vault, objectTypes.VAULT, vault);
      vaultTable.push({
        id: vault,
        name: decryptedState.name
      });
    }
    return vaultTable;
  }

  public async getContractState(id: string): Promise<Contract> {
    const state = await this.api.getContractState(id);
    this.service.setIsPublic(state.isPublic);
    const contract = await this.decryptState(state);
    contract.folders = await this.decryptState(state.folders);
    contract.stacks = await this.decryptState(state.stacks);
    contract.notes = await this.decryptState(state.notes);
    contract.memos = await this.decryptState(state.memos);
    return contract;
  }

  /**
   * @param  {string} vaultId
   * @param  {string} objectType
   * @returns Promise with nodes array
   */
  public async getNodes(vaultId: string, objectType: string): Promise<any> {
    const nodes = await this.api.getObjectsByVaultId(vaultId, objectType);
    let nodeTable = [];
    await this.setVaultEncryptionContext(vaultId);
    for (let node of nodes) {
      const decryptedState = await this.service.processReadObject(node.state, ["title", "name", "message"]);
      nodeTable.push({
        id: node.id,
        createdAt: node.createdAt,
        ...decryptedState
      });
    }
    return nodeTable;
  }

  /**
   * @param  {string} objectId
   * @param  {string} objectType
   * @param  {string} [vaultId]
   * @returns Promise with decrypted node state
   */
  public async decryptNode(objectId: string, objectType: string, vaultId?: string): Promise<any> {
    const state = await this.api.getNodeState(objectId, objectType, vaultId);
    if (vaultId) {
      await this.setVaultEncryptionContext(vaultId);
    } else {
      const object = await this.api.getObject(objectId, objectType);
      await this.setVaultEncryptionContext(object.dataRoomId || object.id);
    }
    return this.decryptState(state);
  }

  /**
   * @param  {string} objectId
   * @param  {string} objectType
   * @returns Promise with decrypted object
   */
  public async decryptObject(objectId: string, objectType: string): Promise<any> {
    const object = await this.api.getObject(objectId, objectType);
    await this.setVaultEncryptionContext(object.dataRoomId || object.id);
    object.state = await this.decryptState(object.state);
    return object;
  }

  /**
   * Decrypt given state (require encryption context)
   * @param  {any} state
   * @returns Promise with decrypted state
   */
  public async decryptState<T>(state: T): Promise<T> {
    const decryptedState = await this.service.processReadObject(state, ["title", "name", "message", "content"]);
    if (decryptedState.files && decryptedState.files.length > 0) {
      for (const [index, file] of decryptedState.files.entries()) {
        const decryptedFile = await this.service.processReadObject(file, ["title", "name"]);
        decryptedState.files[index] = decryptedFile;
      }
    }
    if (decryptedState.reactions && decryptedState.reactions.length > 0) {
      for (const [index, reaction] of decryptedState.reactions.entries()) {
        const decryptedReaction = await this.service.processReadObject(reaction, ["reaction"]);
        decryptedState.reactions[index] = decryptedReaction;
      }
    }
    if (decryptedState.revisions && decryptedState.revisions.length > 0) {
      for (const [index, revision] of decryptedState.revisions.entries()) {
        const decryptedRevision = await this.service.processReadObject(revision, ["content"]);
        decryptedState.revisions[index] = decryptedRevision;
      }
    }
    return decryptedState;
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

  /**
   * Get file stack version by index, return the latest version by default
   * @param  {string} stackId
   * @param  {string} [index] file version index
   * @returns Promise with file name & data buffer
   */
  public async getStackFile(stackId: string, index?: string): Promise<{ name: string, data: ArrayBuffer }> {
    const stack = await this.api.getObject(stackId, objectTypes.STACK);
    let file: any;
    if (index) {
      if (stack.state.files && stack.state.files[index]) {
        file = stack.state.files[index];
      } else {
        throw new Error("Given index: " + index + " does not exist for stack: " + stackId);
      }
    } else {
      file = stack.state.files[stack.state.files.length - 1];
    }
    const fileBuffer = await this.getFile(file.resourceUrl, stack.dataRoomId);
    const fileName = await this.service.processReadString(file.title);
    return { name: fileName, data: fileBuffer };
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

  private async setVaultEncryptionContext(vaultId: string): Promise<any> {
    const encryptionKeys = await this.api.getMembershipKeys(vaultId, this.service.wallet);
    if (encryptionKeys.encryptionType) {
      const keys = encryptionKeys.keys.map(((keyPair) => {
        return {
          encPrivateKey: keyPair.encPrivateKey,
          publicKey: keyPair.publicKey ? keyPair.publicKey : keyPair.encPublicKey
        }
      }))
      this.service.setKeys(keys);
      (<any>this.service).setRawDataEncryptionPublicKey(encryptionKeys?.getPublicKey());
      this.service.setIsPublic(false);
    } else {
      this.service.setIsPublic(true);
    }
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