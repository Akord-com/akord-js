import { Api, ApiFactory } from "./api";
import { ClientConfig } from "./client-config";
import { ServiceInterface, ServiceFactory } from "./service";
import { Wallet } from "@akord/crypto";
import { reactionEmoji, actionRefs, status, objectTypes } from "./constants";
import { v4 as uuidv4 } from "uuid";

export default class Akord {
  static readonly reactionEmoji = reactionEmoji;

  public api: Api;
  public service: ServiceInterface;
  static signIn: (email: string, password: string) => Promise<Akord>;

  // TODO: JWT token provider
  constructor(config: ClientConfig, wallet?: Wallet, jwtToken?: string) {
    this.api = new ApiFactory(config, wallet, jwtToken).apiInstance();
    this.service = new ServiceFactory(config.ledgerVersion, wallet, this.api).serviceInstance();
  }

  private async setVaultContext(vaultId: string) {
    const vault = await this.api.getObject(vaultId, objectTypes.VAULT);
    const ledgerVersion = this.api.getLedgerVersion(vault);
    const service = new ServiceFactory(ledgerVersion, this.service.wallet, this.api).serviceInstance();
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

  private async setVaultContextFromObjectId(objectId: string, objectType: string) {
    const object = await this.api.getObject(objectId, objectType);
    const service = await this.setVaultContext(object.dataRoomId);
    service.setPrevHash(object.hash);
    service.setObject(object);
    service.setObjectId(objectId);
    service.setObjectType(objectType);
    return service;
  }

  public async vaultCreate(name: string, termsOfAccess?: string, isPublic?: boolean): Promise<{
    transactionId: string,
    vaultId: string,
    membershipId: string
  }> {
    const memberDetails = await this.service.getProfileDetails();
    this.service.setActionRef(actionRefs.VAULT_CREATE);
    return this.service.vaultCreate(name, termsOfAccess, memberDetails, isPublic);
  }

  public async vaultRename(vaultId: string, name: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContext(vaultId);
    service.setPrevHash(service.vault.hash);
    service.setObjectId(vaultId);
    service.setObjectType(objectTypes.VAULT);
    service.setActionRef(actionRefs.VAULT_RENAME);
    return service.nodeRename(name);
  }

  public async vaultArchive(vaultId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContext(vaultId);
    service.setPrevHash(service.vault.hash);
    service.setObjectId(vaultId);
    service.setObjectType(objectTypes.VAULT);
    service.setActionRef(actionRefs.VAULT_ARCHIVE);
    return service.vaultArchive();
  }

  public async vaultRestore(vaultId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContext(vaultId);
    service.setPrevHash(service.vault.hash);
    service.setObjectId(vaultId);
    service.setObjectType(objectTypes.VAULT);
    service.setActionRef(actionRefs.VAULT_RESTORE);
    return service.nodeRestore();
  }

  public async vaultDelete(vaultId: string): Promise<{ transactionId: string }> {
    const vault = await this.api.getObject(vaultId, objectTypes.VAULT);
    const service = new ServiceFactory(<any>"v1", this.service.wallet, this.api).serviceInstance();
    service.setPrevHash(vault.hash);
    service.setObjectId(vaultId);
    service.setObjectType(objectTypes.VAULT);
    service.setVaultId(vaultId);
    service.setActionRef(actionRefs.VAULT_DELETE);
    return service.vaultDelete();
  }

  public async membershipInvite(vaultId: string, email: string, role: string): Promise<{
    membershipId: string,
    transactionId: string
  }> {
    const service = await this.setVaultContext(vaultId);
    service.setActionRef(actionRefs.MEMBERSHIP_INVITE);
    return service.membershipInvite(email, role);
  }

  public async membershipAccept(membershipId: string): Promise<{ transactionId: string }> {
    const memberDetails = await this.service.getProfileDetails();
    const service = await this.setVaultContextFromObjectId(membershipId, objectTypes.MEMBERSHIP);
    service.setActionRef(actionRefs.MEMBERSHIP_ACCEPT);
    return service.membershipAccept(memberDetails);
  }

  public async membershipConfirm(membershipId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(membershipId, objectTypes.MEMBERSHIP);
    service.setActionRef(actionRefs.MEMBERSHIP_CONFIRM);
    return service.membershipConfirm();
  }

  public async membershipReject(membershipId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(membershipId, objectTypes.MEMBERSHIP);
    service.setActionRef(actionRefs.MEMBERSHIP_REJECT);
    return service.membershipReject();
  }

  public async membershipLeave(membershipId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(membershipId, objectTypes.MEMBERSHIP);
    service.setActionRef(actionRefs.MEMBERSHIP_LEAVE);
    return service.membershipReject();
  }

  public async membershipRevoke(membershipId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(membershipId, objectTypes.MEMBERSHIP);
    service.setActionRef(actionRefs.MEMBERSHIP_REVOKE);
    return service.membershipRevoke();
  }

  public async membershipChangeRole(membershipId: string, role: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(membershipId, objectTypes.MEMBERSHIP);
    service.setActionRef(actionRefs.MEMBERSHIP_CHANGE_ROLE);
    return service.membershipChangeRole(role);
  }

  public async memoCreate(vaultId: string, message: string): Promise<{ memoId: string, transactionId: string }> {
    const service = await this.setVaultContext(vaultId);
    service.setActionRef(actionRefs.MEMO_CREATE);
    return service.memoCreate(message);
  }

  public async memoAddReaction(memoId: string, reaction: reactionEmoji): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(memoId, objectTypes.MEMO);
    const memberDetails = await service.getProfileDetails();
    const author = memberDetails.fullName || memberDetails.email;
    service.setActionRef(actionRefs.MEMO_ADD_REACTION);
    return service.memoAddReaction(reaction, author);
  }

  public async memoRemoveReaction(memoId: string, reaction: reactionEmoji): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(memoId, objectTypes.MEMO);
    service.setActionRef(actionRefs.MEMO_REMOVE_REACTION);
    return service.memoRemoveReaction(reaction);
  }

  public async stackCreate(vaultId: string, file: any, name: string, parentId?: string, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{
    stackId: string,
    transactionId: string
  }> {
    const service = await this.setVaultContext(vaultId);
    service.setActionRef(actionRefs.STACK_CREATE);
    return service.stackCreate(name, file, parentId, progressHook, cancelHook);
  }

  public async stackRename(stackId: string, name: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(stackId, objectTypes.STACK);
    service.setActionRef(actionRefs.STACK_RENAME);
    return service.nodeRename(name);
  }

  public async stackUploadRevision(stackId: string, file: any, progressHook?: (progress: number) => void): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(stackId, objectTypes.STACK);
    service.setActionRef(actionRefs.STACK_UPLOAD_REVISION);
    return service.stackUploadRevision(file, progressHook);
  }

  public async stackRevoke(stackId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(stackId, objectTypes.STACK);
    service.setActionRef(actionRefs.STACK_REVOKE);
    return service.nodeRevoke();
  }

  public async stackMove(stackId: string, parentId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(stackId, objectTypes.STACK);
    service.setActionRef(actionRefs.STACK_MOVE);
    return service.nodeMove(parentId);
  }

  public async stackRestore(stackId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(stackId, objectTypes.STACK);
    service.setActionRef(actionRefs.STACK_RESTORE);
    return service.nodeRestore();
  }

  public async stackDelete(stackId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(stackId, objectTypes.STACK);
    service.setActionRef(actionRefs.STACK_DELETE);
    return service.nodeDelete();
  }

  public async folderCreate(vaultId: string, name: string, parentId?: string): Promise<{
    folderId: string,
    transactionId: string
  }> {
    const service = await this.setVaultContext(vaultId);
    service.setActionRef(actionRefs.FOLDER_CREATE);
    return service.folderCreate(name, parentId);
  }

  public async folderRename(folderId: string, name: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(folderId, objectTypes.FOLDER);
    service.setActionRef(actionRefs.FOLDER_RENAME);
    return service.nodeRename(name);
  }

  public async folderMove(folderId: string, parentId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(folderId, objectTypes.FOLDER);
    service.setActionRef(actionRefs.FOLDER_MOVE);
    return service.nodeMove(parentId);
  }

  public async folderRevoke(folderId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(folderId, objectTypes.FOLDER);
    service.setActionRef(actionRefs.FOLDER_REVOKE);
    return service.nodeRevoke();
  }

  public async folderRestore(folderId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(folderId, objectTypes.FOLDER);
    service.setActionRef(actionRefs.FOLDER_RESTORE);
    return service.nodeRestore();
  }

  public async folderDelete(folderId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(folderId, objectTypes.FOLDER);
    service.setActionRef(actionRefs.FOLDER_DELETE);
    return service.nodeDelete();
  }

  public async noteCreate(vaultId: string, name: string, content: any, parentId?: string): Promise<{
    noteId: string,
    transactionId: string
  }> {
    const service = await this.setVaultContext(vaultId);
    service.setActionRef(actionRefs.NOTE_CREATE);
    return service.noteCreate(name, JSON.stringify(content), parentId);
  }

  public async noteUploadRevision(noteId: string, name: string, content: string): Promise<{
    transactionId: string
  }> {
    const service = await this.setVaultContextFromObjectId(noteId, objectTypes.NOTE);
    service.setActionRef(actionRefs.NOTE_UPLOAD_REVISION);
    return service.noteUploadRevision(name, JSON.stringify(content));
  }

  public async noteMove(noteId: string, parentId?: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(noteId, objectTypes.NOTE);
    service.setActionRef(actionRefs.NOTE_MOVE);
    return service.nodeMove(parentId);
  }

  public async noteRevoke(noteId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(noteId, objectTypes.NOTE);
    service.setActionRef(actionRefs.NOTE_REVOKE);
    return service.nodeRevoke();
  }

  public async noteRestore(noteId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(noteId, objectTypes.NOTE);
    service.setActionRef(actionRefs.NOTE_RESTORE);
    return service.nodeRestore();
  }

  public async noteDelete(noteId: string): Promise<{ transactionId: string }> {
    const service = await this.setVaultContextFromObjectId(noteId, objectTypes.NOTE);
    service.setActionRef(actionRefs.NOTE_DELETE);
    return service.nodeDelete();
  }

  public async batchRevoke(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    return this.batchAction(items, "REVOKE");
  }

  public async batchRestore(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    return this.batchAction(items, "RESTORE");
  }

  public async batchDelete(items: { id: string, objectType: string }[]): Promise<{ transactionId: string }[]> {
    return this.batchAction(items, "DELETE");
  }

  public async batchMove(items: { id: string, objectType: string }[], parentId?: string): Promise<{ transactionId: string }[]> {
    return this.batchAction(items, "MOVE", parentId);
  }

  public async batchMembershipChangeRole(items: { id: string, role: string }[]): Promise<{ transactionId: string }[]> {
    return this.batchAction(items.map((item) => ({ ...item, objectType: objectTypes.MEMBERSHIP })), "CHANGE_ROLE");
  }

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
    const ledgerVersion = this.api.getLedgerVersion(vault);
    let encryptionKeys = {} as any;
    if (!vault.state?.isPublic) {
      encryptionKeys = await this.api.getMembershipKeys(vaultId, this.service.wallet);
    }
    const response = [] as { stackId: string, transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const service = new ServiceFactory(ledgerVersion, this.service.wallet, this.api).serviceInstance();
      service.setVault(vault);
      service.setVaultId(vaultId);
      service.setIsPublic(vault.state?.isPublic);
      service.setGroupRef(groupRef);
      if (!service.isPublic) {
        service.setKeys(encryptionKeys.keys);
        (<any>service).setRawDataEncryptionPublicKey(encryptionKeys?.getPublicKey());
      }
      response.push(await service.stackCreate(item.name, item.file, parentId, progressHook, cancelHook));
    }));
    return response;
  }

  private async batchAction(
    items: { id: string, objectType: string, role?: string }[],
    actionType: string,
    parentId?: string,
  ): Promise<{ transactionId: string }[]> {
    const groupRef = items && items.length > 1 ? uuidv4() : null;
    const vaultId = (await this.api.getObject(items[0].id, items[0].objectType)).dataRoomId;
    const vault = await this.api.getObject(vaultId, objectTypes.VAULT);
    const ledgerVersion = this.api.getLedgerVersion(vault);
    let encryptionKeys = {} as any;
    if (!vault.state?.isPublic) {
      encryptionKeys = await this.api.getMembershipKeys(vaultId, this.service.wallet);
    }
    const transactionIds = [] as { transactionId: string }[];
    await Promise.all(items.map(async (item) => {
      const object = await this.api.getObject(item.id, item.objectType);
      const service = new ServiceFactory(ledgerVersion, this.service.wallet, this.api).serviceInstance();
      service.setVault(vault);
      service.setVaultId(vaultId);
      service.setIsPublic(vault.state?.isPublic);
      service.setGroupRef(groupRef);
      if (!service.isPublic) {
        service.setKeys(encryptionKeys.keys);
        (<any>service).setRawDataEncryptionPublicKey(encryptionKeys?.getPublicKey());
      }
      service.setPrevHash(object.hash);
      service.setObject(object);
      service.setObjectId(item.id);
      service.setObjectType(item.objectType);
      service.setActionRef(actionRefs[item.objectType.toUpperCase() + "_" + actionType]);
      switch (actionType) {
        case "REVOKE":
          transactionIds.push(await service.nodeRevoke());
          break;
        case "RESTORE":
          transactionIds.push(await service.nodeRestore());
          break;
        case "MOVE":
          transactionIds.push(await service.nodeMove(parentId));
          break;
        case "DELETE":
          transactionIds.push(await service.nodeDelete());
          break;
        case "CHANGE_ROLE":
          transactionIds.push(await service.membershipChangeRole(item.role));
          break;
        default:
          break;
      }
    }));
    return transactionIds;
  }

  public async membershipInviteNewUser(vaultId: string, email: string, role: string): Promise<{
    membershipId: string,
    transactionId: string
  }> {
    const service = new ServiceFactory(<any>"v1", this.service.wallet, this.api).serviceInstance();
    service.setVaultId(vaultId);
    service.setActionRef(actionRefs.MEMBERSHIP_INVITE);
    return service.membershipInviteNewUser(email, role);
  }

  public async batchMembershipInvite(vaultId: string, items: { email: string, role: string }[]): Promise<{
    membershipId: string,
    transactionId: string
  }[]> {
    const groupRef = items && items.length > 1 ? uuidv4() : null;
    const vault = await this.api.getObject(vaultId, objectTypes.VAULT);
    const ledgerVersion = this.api.getLedgerVersion(vault);
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
      const service = new ServiceFactory(userHasAccount
        ? ledgerVersion
        : <any>"v1"
        , this.service.wallet, this.api).serviceInstance();
      service.setVault(vault);
      service.setVaultId(vaultId);
      service.setIsPublic(vault.state?.isPublic);
      service.setGroupRef(groupRef);
      service.setActionRef(actionRefs.MEMBERSHIP_INVITE);
      if (!service.isPublic) {
        service.setKeys(encryptionKeys.keys);
        (<any>service).setRawDataEncryptionPublicKey(encryptionKeys?.getPublicKey());
      }
      if (userHasAccount) {
        response.push(await service.membershipInvite(email, role));
      } else {
        response.push(await service.membershipInviteNewUser(email, role));
      }
    }));
    return response;
  }

  public async membershipInviteResend(membershipId: string): Promise<{ transactionId: string }> {
    const service = new ServiceFactory(<any>"v1", this.service.wallet, this.api).serviceInstance();
    const object = await this.api.getObject(membershipId, objectTypes.MEMBERSHIP);
    service.setVaultId(object.dataRoomId);
    service.setPrevHash(object.hash);
    service.setObjectId(membershipId);
    service.setObject(object);
    service.setObjectType(objectTypes.MEMBERSHIP);
    service.setActionRef(actionRefs.MEMBERSHIP_INVITE_RESEND);
    if (object.status === status.PENDING) {
      return service.membershipInviteResend();
    } else if (object.status === status.INVITED) {
      return service.membershipInviteNewUserResend();
    } else {
      throw new Error("Cannot resend the invitation for member: " + membershipId +
        ". Found invalid status: " + object.status);
    }
  }

  public async getProfileDetails(): Promise<{ profileDetails: any }> {
    return await this.service.getProfileDetails();
  }

  public async profileUpdate(name: string, avatar: any): Promise<{ transactionId: string }[]> {
    let transactions = [];

    const profilePromise = new Promise<void>(async (resolve, reject) => {
      const profileService = new ServiceFactory(<any>"v1", this.service.wallet, this.api).serviceInstance();
      profileService.setActionRef(actionRefs.PROFILE_UPDATE);
      const { transactionId } = await profileService.profileUpdate(name, avatar);
      transactions.push(transactionId);
      resolve();
    })

    const memberships = await this.api.getMemberships(this.service.wallet);
    const membershipPromiseArray = memberships.map(async (membership) => {
      const service = await this.setVaultContextFromObjectId(membership.id, objectTypes.MEMBERSHIP);
      service.setActionRef(actionRefs.MEMBERSHIP_PROFILE_UPDATE);
      const { transactionId } = await service.membershipProfileUpdate(name, avatar);
      transactions.push(transactionId);
    })

    await Promise.all(membershipPromiseArray.concat([profilePromise]));
    return transactions;
  }

  public async getVaults(): Promise<any> {
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

  public async decryptObject(objectId: string, objectType: string): Promise<any> {
    const object = await this.api.getObject(objectId, objectType);
    await this.setVaultEncryptionContext(object.dataRoomId || object.id);
    object.state = await this.decryptState(object.state);
    return object;
  }

  public async decryptState(state: any): Promise<any> {
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

  public async getFile(id: string, vaultId: string, isChunked?: boolean, numberOfChunks?: number, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<any> {
    const service = await this.setVaultContext(vaultId);
    let fileBinary
    if (isChunked) {
      let currentChunk = 0;
      try {
        while (currentChunk < numberOfChunks) {
          const url = `${id}_${currentChunk}`;
          const file = await this.api.downloadFile(url, service.isPublic, progressHook, cancelHook);
          const fileData = await service.processReadRaw(file.fileData, file.headers)
          fileBinary = this._appendBuffer(fileBinary, fileData);
          currentChunk++;
        }
      } catch (e) {
        console.log(e);
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

  public async getPublicFile(id: string, isChunked?: boolean, numberOfChunks?: number, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<any> {
    this.service.setIsPublic(true);
    let fileBinary
    if (isChunked) {
      let currentChunk = 0;
      try {
        while (currentChunk < numberOfChunks) {
          const url = `${id}_${currentChunk}`;
          const file = await this.api.downloadFile(url, true, progressHook, cancelHook);
          const fileData = await this.service.processReadRaw(file.fileData, file.headers)
          fileBinary = this._appendBuffer(fileBinary, fileData);
          currentChunk++;
        }
      } catch (e) {
        console.log(e);
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

  public async getStackFile(stackId: string, index?: string): Promise<any> {
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
    return this.getFile(file.resourceUrl, stack.dataRoomId);
  }

  public static init: (apiConfig: ClientConfig, wallet: Wallet, jwtToken?: string) => Promise<Akord>;

  private _appendBuffer(buffer1: Uint8Array, buffer2: Uint8Array): ArrayBufferLike {
    if (!buffer1 && !buffer2) return;
    if (!buffer1) return buffer2;
    if (!buffer2) return buffer1;
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
  }
}