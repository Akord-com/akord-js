import { actionRefs, objectType, status, functions, protocolTags } from "../constants";
import { v4 as uuidv4 } from "uuid";
import { EncryptedKeys } from "@akord/crypto";
import { Vault, VaultCreateOptions, VaultCreateResult, VaultUpdateOptions, VaultUpdateResult } from "../types/vault";
import { Service } from "./service";
import { Tag } from "../types/contract";
import { ListOptions, VaultGetOptions } from "../types/query-options";
import { Paginated } from "../types/paginated";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";
import { MembershipService } from "./membership";
import lodash from "lodash";
import { NotFound } from "../errors/not-found";
import { BadRequest } from "../errors/bad-request";
import { handleListErrors, paginate } from "./common";

class VaultService extends Service {
  objectType = objectType.VAULT;

  defaultListOptions = {
    shouldDecrypt: true,
    filter: { status: { eq: status.ACCEPTED } }
  } as ListOptions;

  defaultGetOptions = {
    shouldDecrypt: true,
    deep: false
  } as VaultGetOptions;

  defaultCreateOptions = {
    public: false,
    termsOfAccess: undefined,
    description: undefined,
    tags: [],
    cloud: false,
    arweaveTags: [],
  } as VaultCreateOptions;

  /**
   * @param  {string} vaultId
   * @returns Promise with the decrypted vault
   */
  public async get(vaultId: string, options: VaultGetOptions = this.defaultGetOptions): Promise<Vault> {
    const getOptions = {
      ...this.defaultGetOptions,
      ...options
    }
    const result = await this.api.getVault(vaultId, getOptions);
    return await this.processVault(result, !result.public && getOptions.shouldDecrypt, result.__keys__);
  }

  /**
   * @param  {ListOptions} options
   * @returns Promise with paginated user vaults
   */
  public async list(options: ListOptions = this.defaultListOptions): Promise<Paginated<Vault>> {
    const listOptions = {
      ...this.defaultListOptions,
      ...options
    }
    const response = await this.api.getVaults(listOptions);
    const promises = response.items
      .map(async (vaultProto: Vault) => {
        return await this.processVault(vaultProto, listOptions.shouldDecrypt, vaultProto.keys);
      }) as Promise<Vault>[];
    const { items, errors } = await handleListErrors<Vault>(response.items, promises);
    return {
      items,
      nextToken: response.nextToken,
      errors
    }
  }

  /**
   * @param  {ListOptions} options
   * @returns Promise with currently authenticated user vaults
   */
  public async listAll(options: ListOptions = this.defaultListOptions): Promise<Array<Vault>> {
    const list = async (listOptions: ListOptions) => {
      return await this.list(listOptions);
    }
    return await paginate<Vault>(list, options);
  }

  /**
   * @param  {string} name new vault name
   * @param  {VaultCreateOptions} options public/private, terms of access, etc.
   * @returns Promise with new vault id, owner membership id & corresponding transaction id
   */
  public async create(name: string, options: VaultCreateOptions = this.defaultCreateOptions): Promise<VaultCreateResult> {
    const createOptions = {
      ...this.defaultCreateOptions,
      ...options
    }

    let vaultId: string
    if (createOptions.cloud) {
      vaultId = uuidv4();
    } else {
      vaultId = await this.api.initContractId([new Tag(protocolTags.NODE_TYPE, objectType.VAULT)]);
    }

    this.setActionRef(actionRefs.VAULT_CREATE);
    this.setIsPublic(createOptions.public);
    this.setFunction(functions.VAULT_CREATE);
    this.setVaultId(vaultId);
    this.setObjectId(vaultId);
    this.setAkordTags((this.isPublic ? [name] : []).concat(createOptions.tags));

    const address = await this.wallet.getAddress();
    const membershipId = uuidv4();

    this.arweaveTags = [
      new Tag(protocolTags.MEMBER_ADDRESS, address),
      new Tag(protocolTags.MEMBERSHIP_ID, membershipId),
    ].concat(await this.getTxTags());
    createOptions.arweaveTags?.map((tag: Tag) => this.arweaveTags.push(tag));

    const memberService = new MembershipService(this.wallet, this.api, this);
    memberService.setVaultId(this.vaultId);
    memberService.setObjectId(membershipId);

    let keys: EncryptedKeys[];
    if (!this.isPublic) {
      const { memberKeys, keyPair } = await memberService.rotateMemberKeys(
        new Map([[membershipId, this.wallet.publicKey()]])
      );
      keys = memberKeys.get(membershipId);
      this.setRawDataEncryptionPublicKey(keyPair.publicKey);
      this.setKeys([{ encPublicKey: keys[0].encPublicKey, encPrivateKey: keys[0].encPrivateKey }]);
      memberService.setRawDataEncryptionPublicKey(keyPair.publicKey);
      memberService.setKeys([{ encPublicKey: keys[0].encPublicKey, encPrivateKey: keys[0].encPrivateKey }]);
    }

    const vaultState = {
      name: await this.processWriteString(name),
      termsOfAccess: createOptions.termsOfAccess,
      description: createOptions.description ? await this.processWriteString(createOptions.description) : undefined,
      tags: createOptions.tags || []
    }
    const vaultStateTx = await this.uploadState(vaultState, createOptions.cloud);

    const memberState = {
      keys,
      encPublicSigningKey: await memberService.processWriteString(this.wallet.signingPublicKey())
    }

    const memberStateTx = await memberService.uploadState(memberState, createOptions.cloud);

    const data = { vault: vaultStateTx, membership: memberStateTx };

    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function, data },
      this.arweaveTags,
      { cloud: createOptions.cloud }
    );
    const vault = await this.processVault(object, true, this.keys);
    return { vaultId, membershipId, transactionId: id, object: vault };
  }

  /**
   * @param  {string} vaultId
   * @param  {VaultUpdateOptions} options name, description & tags
   * @returns Promise with corresponding transaction id
   */
  public async update(vaultId: string, options: VaultUpdateOptions): Promise<VaultUpdateResult> {
    if (!options.name && !options.tags && !options.description) {
      throw new BadRequest("Nothing to update");
    }
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_UPDATE_METADATA);
    this.setFunction(functions.VAULT_UPDATE);

    const currentState = await this.getCurrentState();
    const newState = lodash.cloneDeepWith(currentState);

    if (options.name) {
      newState.name = await this.processWriteString(options.name);
    }
    if (options.tags) {
      newState.tags = options.tags;
    }
    if (options.description) {
      newState.description = await this.processWriteString(options.description);
    }
    this.setAkordTags((options.name && this.isPublic ? [options.name] : []).concat(options.tags));
    this.arweaveTags = await this.getTxTags();

    const dataTxId = await this.uploadState(newState, this.vault.cloud);
    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function, data: dataTxId },
      this.arweaveTags
    );
    const vault = await this.processVault(object, true, this.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param vaultId
   * @param name new vault name
   * @returns Promise with corresponding transaction id
   */
  public async rename(vaultId: string, name: string): Promise<VaultUpdateResult> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_RENAME);
    this.setFunction(functions.VAULT_UPDATE);
    const state = {
      name: await this.processWriteString(name)
    };
    const data = await this.mergeAndUploadState(state, this.vault.cloud);
    this.setAkordTags(this.isPublic ? [name] : []);
    this.arweaveTags = await this.getTxTags();

    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function, data },
      this.arweaveTags
    );
    const vault = await this.processVault(object, true, this.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param vaultId
   * @param tags tags to be added
   * @returns Promise with corresponding transaction id
   */
  public async addTags(vaultId: string, tags: string[]): Promise<VaultUpdateResult> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_ADD_TAGS);
    this.setFunction(functions.VAULT_UPDATE);

    this.setAkordTags(tags);
    this.arweaveTags = await this.getTxTags();

    const currentState = await this.getCurrentState();
    const newState = lodash.cloneDeepWith(currentState);
    if (!newState.tags) {
      newState.tags = [];
    }
    for (const tag of tags) {
      if (newState.tags.indexOf(tag) === -1) {
        newState.tags.push(tag);
      }
    }
    const dataTxId = await this.uploadState(newState, this.vault.cloud);

    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function, data: dataTxId },
      this.arweaveTags
    );
    const vault = await this.processVault(object, true, this.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param vaultId
   * @param tags tags to be removed
   * @returns Promise with corresponding transaction id
   */
  public async removeTags(vaultId: string, tags: string[]): Promise<VaultUpdateResult> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_REMOVE_TAGS);
    this.setFunction(functions.VAULT_UPDATE);
    this.arweaveTags = await this.getTxTags();

    const currentState = await this.getCurrentState();
    const newState = lodash.cloneDeepWith(currentState);
    if (!newState.tags || newState.tags.length === 0) {
      throw new BadRequest("Tags cannot be removed, vault does not have any");
    }
    for (const tag of tags) {
      const index = this.getTagIndex(newState.tags, tag);
      newState.tags.splice(index, 1);
    }
    const dataTxId = await this.uploadState(newState, this.vault.cloud);

    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function, data: dataTxId },
      this.arweaveTags
    );
    const vault = await this.processVault(object, true, this.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding transaction id
   */
  public async archive(vaultId: string): Promise<VaultUpdateResult> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_ARCHIVE);
    this.setFunction(functions.VAULT_ARCHIVE);

    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function },
      await this.getTxTags()
    );
    const vault = await this.processVault(object, true, this.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding transaction id
   */
  public async restore(vaultId: string): Promise<VaultUpdateResult> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_RESTORE);
    this.setFunction(functions.VAULT_RESTORE);

    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function },
      await this.getTxTags()
    );
    const vault = await this.processVault(object, true, this.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding transaction id
   */
  public async delete(vaultId: string): Promise<{ transactionId: string }> {
    this.api.deleteVault(vaultId);
    return { transactionId: "" };
  }

  public async setVaultContext(vaultId: string): Promise<void> {
    await super.setVaultContext(vaultId);
    this.setObjectId(vaultId);
    this.setObject(this.vault);
  }

  protected async processVault(object: Vault, shouldDecrypt: boolean, keys?: EncryptedKeys[]): Promise<Vault> {
    const vault = new Vault(object, keys);
    if (shouldDecrypt && !vault.public) {
      try {
        await vault.decrypt();
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
    return vault;
  }

  private getTagIndex(tags: string[], tag: string): number {
    const index = tags.indexOf(tag);
    if (index === -1) {
      throw new NotFound("Could not find tag: " + tag + " for given vault.");
    }
    return index;
  }
};

export {
  VaultService
}