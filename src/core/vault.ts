import { actionRefs, objectType, status, functions, protocolTags } from "../constants";
import { v4 as uuidv4 } from "uuid";
import { EncryptedKeys, Wallet } from "@akord/crypto";
import { Vault, VaultCreateOptions, VaultCreateResult, VaultUpdateOptions, VaultUpdateResult } from "../types/vault";
import { Service } from "./service/service";
import { Tag } from "../types/contract";
import { ListOptions, VaultGetOptions, validateListPaginatedApiOptions } from "../types/query-options";
import { Paginated } from "../types/paginated";
import { BadRequest } from "../errors/bad-request";
import { paginate, processListItems } from "./common";
import { Api } from "../api/api";
import { MembershipService } from "./service/membership";
import { VaultService } from "./service/vault";
import lodash from "lodash";

class VaultModule {
  protected service: VaultService;

  constructor(wallet: Wallet, api: Api, service?: Service) {
    this.service = new VaultService(wallet, api, service);
  }

  protected defaultListOptions = {
    shouldDecrypt: true,
    filter: { status: { eq: status.ACCEPTED } }
  } as ListOptions;

  protected defaultGetOptions = {
    shouldDecrypt: true,
    deep: false
  } as VaultGetOptions;

  protected defaultCreateOptions = {
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
    const result = await this.service.api.getVault(vaultId, getOptions);
    return await this.service.processVault(result, !result.public && getOptions.shouldDecrypt, result.__keys__);
  }

  /**
   * @param  {ListOptions} options
   * @returns Promise with paginated user vaults
   */
  public async list(options: ListOptions = this.defaultListOptions): Promise<Paginated<Vault>> {
    validateListPaginatedApiOptions(options);
    const listOptions = {
      ...this.defaultListOptions,
      ...options
    }
    const response = await this.service.api.getVaults(listOptions);
    const items = [];
    const errors = [];
    const processVault = async (vaultProto: Vault) => {
      try {
        const node = await this.service.processVault(vaultProto, listOptions.shouldDecrypt, vaultProto.keys);
        items.push(node);
      } catch (error) {
        errors.push({ id: vaultProto.id, error });
      };
    }
    await processListItems(response.items, processVault);
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
      vaultId = await this.service.api.initContractId([new Tag(protocolTags.NODE_TYPE, objectType.VAULT)]);
    }

    this.service.setActionRef(actionRefs.VAULT_CREATE);
    this.service.setIsPublic(createOptions.public);
    this.service.setFunction(functions.VAULT_CREATE);
    this.service.setVaultId(vaultId);
    this.service.setObjectId(vaultId);
    this.service.setAkordTags((this.service.isPublic ? [name] : []).concat(createOptions.tags));

    const address = await this.service.wallet.getAddress();
    const membershipId = uuidv4();

    this.service.arweaveTags = [
      new Tag(protocolTags.MEMBER_ADDRESS, address),
      new Tag(protocolTags.MEMBERSHIP_ID, membershipId),
    ].concat(await this.service.getTxTags());
    createOptions.arweaveTags?.map((tag: Tag) => this.service.arweaveTags.push(tag));

    const memberService = new MembershipService(this.service.wallet, this.service.api, this.service);
    memberService.setVaultId(this.service.vaultId);
    memberService.setObjectId(membershipId);

    let keys: EncryptedKeys[];
    if (!this.service.isPublic) {
      const { memberKeys, keyPair } = await memberService.rotateMemberKeys(
        new Map([[membershipId, this.service.wallet.publicKey()]])
      );
      keys = memberKeys.get(membershipId);
      this.service.setRawDataEncryptionPublicKey(keyPair.publicKey);
      this.service.setKeys([{ encPublicKey: keys[0].encPublicKey, encPrivateKey: keys[0].encPrivateKey }]);
      memberService.setRawDataEncryptionPublicKey(keyPair.publicKey);
      memberService.setKeys([{ encPublicKey: keys[0].encPublicKey, encPrivateKey: keys[0].encPrivateKey }]);
    }

    const vaultState = {
      name: await this.service.processWriteString(name),
      termsOfAccess: createOptions.termsOfAccess,
      description: createOptions.description ? await this.service.processWriteString(createOptions.description) : undefined,
      tags: createOptions.tags || []
    }

    const memberState = {
      keys,
      encPublicSigningKey: await memberService.processWriteString(this.service.wallet.signingPublicKey())
    }

    const data = { vault: vaultState, membership: memberState };

    const { id, object } = await this.service.api.postContractTransaction<Vault>(
      this.service.vaultId,
      { function: this.service.function },
      this.service.arweaveTags,
      data,
      false,
      { cloud: createOptions.cloud }
    );
    const vault = await this.service.processVault(object, true, this.service.keys);
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
    await this.service.setVaultContext(vaultId);
    this.service.setActionRef(actionRefs.VAULT_UPDATE_METADATA);
    this.service.setFunction(functions.VAULT_UPDATE);

    const currentState = await this.service.getCurrentState();
    const newState = lodash.cloneDeepWith(currentState);

    if (options.name) {
      newState.name = await this.service.processWriteString(options.name);
    }
    if (options.tags) {
      newState.tags = options.tags;
    }
    if (options.description) {
      newState.description = await this.service.processWriteString(options.description);
    }
    this.service.setAkordTags((options.name && this.service.isPublic ? [options.name] : []).concat(options.tags));
    this.service.arweaveTags = await this.service.getTxTags();

    const { id, object } = await this.service.api.postContractTransaction<Vault>(
      this.service.vaultId,
      { function: this.service.function },
      this.service.arweaveTags,
      newState,
      true
    );
    const vault = await this.service.processVault(object, true, this.service.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param vaultId
   * @param name new vault name
   * @returns Promise with corresponding transaction id
   */
  public async rename(vaultId: string, name: string): Promise<VaultUpdateResult> {
    await this.service.setVaultContext(vaultId);
    this.service.setActionRef(actionRefs.VAULT_RENAME);
    this.service.setFunction(functions.VAULT_UPDATE);
    const state = {
      name: await this.service.processWriteString(name)
    };

    this.service.setAkordTags(this.service.isPublic ? [name] : []);
    this.service.arweaveTags = await this.service.getTxTags();

    const { id, object } = await this.service.api.postContractTransaction<Vault>(
      this.service.vaultId,
      { function: this.service.function },
      this.service.arweaveTags,
      state
    );
    const vault = await this.service.processVault(object, true, this.service.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param vaultId
   * @param tags tags to be added
   * @returns Promise with corresponding transaction id
   */
  public async addTags(vaultId: string, tags: string[]): Promise<VaultUpdateResult> {
    await this.service.setVaultContext(vaultId);
    this.service.setActionRef(actionRefs.VAULT_ADD_TAGS);
    this.service.setFunction(functions.VAULT_UPDATE);

    this.service.setAkordTags(tags);
    this.service.arweaveTags = await this.service.getTxTags();

    const currentState = await this.service.getCurrentState();
    const newState = lodash.cloneDeepWith(currentState);
    if (!newState.tags) {
      newState.tags = [];
    }
    for (const tag of tags) {
      if (newState.tags.indexOf(tag) === -1) {
        newState.tags.push(tag);
      }
    }

    const { id, object } = await this.service.api.postContractTransaction<Vault>(
      this.service.vaultId,
      { function: this.service.function },
      this.service.arweaveTags,
      newState,
      true
    );
    const vault = await this.service.processVault(object, true, this.service.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param vaultId
   * @param tags tags to be removed
   * @returns Promise with corresponding transaction id
   */
  public async removeTags(vaultId: string, tags: string[]): Promise<VaultUpdateResult> {
    await this.service.setVaultContext(vaultId);
    this.service.setActionRef(actionRefs.VAULT_REMOVE_TAGS);
    this.service.setFunction(functions.VAULT_UPDATE);
    this.service.arweaveTags = await this.service.getTxTags();

    const currentState = await this.service.getCurrentState();
    const newState = lodash.cloneDeepWith(currentState);
    if (!newState.tags || newState.tags.length === 0) {
      throw new BadRequest("Tags cannot be removed, vault does not have any");
    }
    for (const tag of tags) {
      const index = this.service.getTagIndex(newState.tags, tag);
      newState.tags.splice(index, 1);
    }

    const { id, object } = await this.service.api.postContractTransaction<Vault>(
      this.service.vaultId,
      { function: this.service.function },
      this.service.arweaveTags,
      newState,
      true
    );
    const vault = await this.service.processVault(object, true, this.service.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding transaction id
   */
  public async archive(vaultId: string): Promise<VaultUpdateResult> {
    await this.service.setVaultContext(vaultId);
    this.service.setActionRef(actionRefs.VAULT_ARCHIVE);
    this.service.setFunction(functions.VAULT_ARCHIVE);

    const { id, object } = await this.service.api.postContractTransaction<Vault>(
      this.service.vaultId,
      { function: this.service.function },
      await this.service.getTxTags()
    );
    const vault = await this.service.processVault(object, true, this.service.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding transaction id
   */
  public async restore(vaultId: string): Promise<VaultUpdateResult> {
    await this.service.setVaultContext(vaultId);
    this.service.setActionRef(actionRefs.VAULT_RESTORE);
    this.service.setFunction(functions.VAULT_RESTORE);

    const { id, object } = await this.service.api.postContractTransaction<Vault>(
      this.service.vaultId,
      { function: this.service.function },
      await this.service.getTxTags()
    );
    const vault = await this.service.processVault(object, true, this.service.keys);
    return { transactionId: id, object: vault };
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding transaction id
   */
  public async delete(vaultId: string): Promise<{ transactionId: string }> {
    this.service.api.deleteVault(vaultId);
    return { transactionId: "" };
  }
};

export {
  VaultModule
}