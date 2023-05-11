import { actionRefs, objectType, status, functions, protocolTags, smartweaveTags } from "../constants";
import { v4 as uuidv4 } from "uuid";
import { generateKeyPair, Encrypter, EncryptedKeys } from "@akord/crypto";
import { Vault } from "../types/vault";
import { Service, STATE_CONTENT_TYPE } from "./service";
import { Tag, Tags } from "../types/contract";
import { ListOptions, VaultGetOptions } from "../types/query-options";
import { Paginated } from "../types/paginated";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";

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
    cacheOnly: false,
    tags: []
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
    if (!getOptions.shouldDecrypt || result.public) {
      return new Vault(result, []);
    }
    const { keys } = await this.api.getMembershipKeys(vaultId);
    const vault = await this.processVault(result, getOptions.shouldDecrypt, keys);
    return vault
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
    const response = await this.api.getVaults(listOptions.filter, listOptions.limit, listOptions.nextToken);
    const promises = response.items
      .map(async (vaultProto: Vault) => {
        return await this.processVault(vaultProto, listOptions.shouldDecrypt, vaultProto.keys);
      }) as Promise<Vault>[];
    const { items, errors } = await this.handleListErrors<Vault>(response.items, promises);
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
    return await this.paginate<Vault>(list, options);
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
    const memberDetails = await this.getProfileDetails();
    this.setActionRef(actionRefs.VAULT_CREATE);
    this.setIsPublic(createOptions.public);

    let keys: Array<EncryptedKeys>;
    if (!this.isPublic) {
      // generate a new vault key pair
      const keyPair = await generateKeyPair();
      this.setRawDataEncryptionPublicKey(keyPair.publicKey);
      const userPublicKey = this.wallet.publicKeyRaw();
      const keysEncrypter = new Encrypter(this.wallet, this.dataEncrypter.keys, userPublicKey);
      try {
        keys = [await keysEncrypter.encryptMemberKey(keyPair)];
        this.setKeys([{ encPublicKey: keys[0].encPublicKey, encPrivateKey: keys[0].encPrivateKey }]);
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }

    let vaultId: string 
    if (createOptions.cacheOnly) {
      vaultId = uuidv4();
    } else {
      vaultId = await this.api.initContractId([new Tag(protocolTags.NODE_TYPE, objectType.VAULT)]);
    }
    this.setFunction(functions.VAULT_CREATE);
    this.setVaultId(vaultId);
    this.setObjectId(vaultId);

    const address = await this.wallet.getAddress();
    const membershipId = uuidv4();

    this.tags = [
      new Tag(protocolTags.MEMBER_ADDRESS, address),
      new Tag(protocolTags.MEMBERSHIP_ID, membershipId),
      new Tag(protocolTags.PUBLIC, createOptions.public ? "true" : "false"),
    ].concat(await this.getTags());

    if (createOptions.tags && createOptions.tags.length) {
      this.tags.push(...createOptions.tags);
    }

    const vaultData = {
      name: await this.processWriteString(name),
      termsOfAccess: createOptions.termsOfAccess
    }
    const vaultSignature = await this.signData(vaultData);
    const membershipData = {
      keys,
      encPublicSigningKey: await this.processWriteString(this.wallet.signingPublicKey()),
      memberDetails: await this.processMemberDetails(memberDetails, true)
    }
    const membershipSignature = await this.signData(membershipData);
    const dataTxIds = await this.api.uploadData([
      {
        data: vaultData, tags: [
          new Tag("Data-Type", "State"),
          new Tag(smartweaveTags.CONTENT_TYPE, STATE_CONTENT_TYPE),
          new Tag(protocolTags.SIGNATURE, vaultSignature),
          new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()),
          new Tag(protocolTags.VAULT_ID, this.vaultId),
          new Tag(protocolTags.NODE_TYPE, this.objectType),
        ]
      },
      {
        data: membershipData, tags: [
          new Tag("Data-Type", "State"),
          new Tag(smartweaveTags.CONTENT_TYPE, STATE_CONTENT_TYPE),
          new Tag(protocolTags.SIGNATURE, membershipSignature),
          new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()),
          new Tag(protocolTags.VAULT_ID, this.vaultId),
          new Tag(protocolTags.NODE_TYPE, objectType.MEMBERSHIP),
          new Tag(protocolTags.MEMBERSHIP_ID, membershipId)
        ]
      }], { shouldBundleTransaction: createOptions.cacheOnly });

    const data = { vault: dataTxIds[0], membership: dataTxIds[1] };

    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function, data },
      this.tags,
      { cacheOnly: createOptions.cacheOnly }
    );
    const vault = await this.processVault(object, true, this.keys);
    return { vaultId, membershipId, transactionId: id, object: vault };
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
    const body = {
      name: await this.processWriteString(name)
    };
    const data = await this.mergeAndUploadBody(body);
    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function, data },
      await this.getTags()
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
      await this.getTags()
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
      await this.getTags()
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
};

export type VaultCreateOptions = {
  public?: boolean,
  termsOfAccess?: string // if the vault is intended for professional or legal use, you can add terms of access and they must be digitally signed before accessing the vault
  cacheOnly?: boolean,
  tags?: Tags
}

type VaultCreateResult = {
  vaultId: string,
  membershipId: string,
  transactionId: string,
  object: Vault
}

type VaultUpdateResult = {
  transactionId: string,
  object: Vault
}

export {
  VaultService
}