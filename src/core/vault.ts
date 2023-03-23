import { actionRefs, objectType, status, functions, protocolTags } from "../constants";
import { v4 as uuidv4 } from "uuid";
import { generateKeyPair, arrayToBase64, Encrypter } from "@akord/crypto";
import { Vault } from "../types/vault";
import { Service } from "./service";
import { Tag } from "../types/contract";
import { ListOptions } from "../types/list-options";
import { Paginated } from "../types/paginated";

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

class VaultService extends Service {
  objectType = objectType.VAULT;

  defaultListOptions = {
    shouldDecrypt: true,
    filter: { status: { eq: status.ACCEPTED } }
  } as ListOptions;

  /**
   * @param  {string} name new vault name
   * @param  {string} [termsOfAccess] if the vault is intended for professional or legal use, you can add terms of access and they must be digitally signed before accessing the vault
   * @param  {boolean} [isPublic]
   * @returns Promise with new vault id, owner membership id & corresponding transaction id
   */
  public async create(name: string, termsOfAccess?: string, isPublic?: boolean): Promise<VaultCreateResult> {
    const memberDetails = await this.getProfileDetails();
    this.setActionRef(actionRefs.VAULT_CREATE);
    this.setIsPublic(isPublic);

    let publicKeys: any, keys: any;
    if (!this.isPublic) {
      // generate a new vault key pair
      const keyPair = await generateKeyPair();
      this.setRawDataEncryptionPublicKey(keyPair.publicKey);
      const userPublicKey = this.wallet.publicKeyRaw();
      const keysEncrypter = new Encrypter(this.wallet, this.dataEncrypter.keys, userPublicKey);
      keys = [await keysEncrypter.encryptMemberKey(keyPair)];
      this.setKeys([{ publicKey: arrayToBase64(keyPair.publicKey), encPrivateKey: keys[0].encPrivateKey }]);
      publicKeys = [arrayToBase64(keyPair.publicKey)];
    }

    const vaultId = await this.api.initContractId([new Tag(protocolTags.NODE_TYPE, objectType.VAULT)]);
    this.setFunction(functions.VAULT_CREATE);
    this.setVaultId(vaultId);
    this.setObjectId(vaultId);

    const address = await this.wallet.getAddress();
    const membershipId = uuidv4();

    this.tags = [
      new Tag(protocolTags.MEMBER_ADDRESS, address),
      new Tag(protocolTags.MEMBERSHIP_ID, membershipId),
      new Tag(protocolTags.PUBLIC, isPublic ? "true" : "false"),
    ].concat(await this.getTags());

    const vaultData = {
      name: await this.processWriteString(name),
      termsOfAccess
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
          new Tag(protocolTags.SIGNATURE, vaultSignature),
          new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()),
          new Tag(protocolTags.VAULT_ID, this.vaultId),
          new Tag(protocolTags.NODE_TYPE, this.objectType),
        ]
      },
      {
        data: membershipData, tags: [
          new Tag("Data-Type", "State"),
          new Tag(protocolTags.SIGNATURE, membershipSignature),
          new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()),
          new Tag(protocolTags.VAULT_ID, this.vaultId),
          new Tag(protocolTags.NODE_TYPE, objectType.MEMBERSHIP),
          new Tag(protocolTags.MEMBERSHIP_ID, membershipId)
        ]
      }], true);

    const data = { vault: dataTxIds[0], membership: dataTxIds[1] };

    const { id, object } = await this.api.postContractTransaction<Vault>(
      this.vaultId,
      { function: this.function, data },
      this.tags
    );
    const vault = new Vault(object, this.keys);
    if (!this.isPublic) {
      await vault.decrypt();
    }
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
    const vault = new Vault(object, this.keys);
    if (!this.isPublic) {
      await vault.decrypt();
    }
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
    const vault = new Vault(object, this.keys);
    if (!this.isPublic) {
      await vault.decrypt();
    }
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
    const vault = new Vault(object, this.keys);
    if (!this.isPublic) {
      await vault.decrypt();
    }
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

  /**
   * @param  {string} vaultId
   * @returns Promise with the decrypted vault
   */
  public async get(vaultId: string, shouldDecrypt = true): Promise<Vault> {
    const result = await this.api.getVault(vaultId);
    if (!shouldDecrypt || result.public) {
      return new Vault(result, []);
    }
    const { keys } = await this.api.getMembershipKeys(vaultId);
    const vault = new Vault(result, keys);
    await vault.decrypt();
    return vault
  }

  /**
   * @param  {ListOptions} listOptions
   * @returns Promise with paginated user vaults
   */
  public async list(listOptions: ListOptions = this.defaultListOptions): Promise<Paginated<Vault>> {
    const response = await this.api.getVaults(listOptions.filter, listOptions.limit, listOptions.nextToken);
    return {
      items: await Promise.all(
        response.items
          .map(async (vaultProto: Vault) => {
            const vault = new Vault(vaultProto, vaultProto.keys);
            if (listOptions.shouldDecrypt && !vault.public) {
              await vault.decrypt();
            }
            return vault as Vault;
          })) as Vault[],
      nextToken: response.nextToken
    }
  }

  /**
  * @param  {ListOptions} listOptions
  * @returns Promise with currently authenticated user vaults
  */
  public async listAll(listOptions: ListOptions = this.defaultListOptions): Promise<Array<Vault>> {
    let token = null;
    let vaults = [] as Vault[];
    do {
      const { items, nextToken } = await this.list(listOptions);
      vaults = vaults.concat(items);
      token = nextToken;
      listOptions.nextToken = nextToken;
      if (nextToken === "null") {
        token = null;
      }
    } while (token);
    return vaults;
  }

  public async setVaultContext(vaultId: string): Promise<void> {
    await super.setVaultContext(vaultId);
    this.setObjectId(vaultId);
    this.setObject(this.vault);
  }
};

export {
  VaultService
}