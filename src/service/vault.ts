import { NodeService } from "./node";
import { actionRefs, objectTypes, commands, protocolTags } from "../constants";
import { v4 as uuidv4 } from "uuid";
import { generateKeyPair, arrayToBase64, jsonToBase64, base64ToJson } from "@akord/crypto";

class VaultService extends NodeService {
  objectType: string = objectTypes.VAULT;

  /**
   * @param  {string} name new vault name
   * @param  {string} [termsOfAccess] if the vault is intended for professional or legal use, you can add terms of access and they must be digitally signed before accessing the vault
   * @param  {boolean} [isPublic]
   * @returns Promise with new vault id, owner membership id & corresponding transaction id
   */
  public async create(name: string, termsOfAccess?: string, isPublic?: boolean): Promise<{
    transactionId: string,
    vaultId: string,
    membershipId: string
  }> {
    const memberDetails = await this.getProfileDetails();
    this.setActionRef(actionRefs.VAULT_CREATE);
    this.setIsPublic(isPublic);

    let publicKeys: any, keys: any;
    if (!this.isPublic) {
      // generate a new vault key pair
      const keyPair = await generateKeyPair();
      const userPublicKey = await this.wallet.publicKeyRaw();
      this.setRawKeysEncryptionPublicKey(userPublicKey);
      this.setRawDataEncryptionPublicKey(keyPair.publicKey);
      keys = [await this.keysEncrypter.encryptMemberKey(keyPair)];
      this.setKeys([{ publicKey: arrayToBase64(keyPair.publicKey), encPrivateKey: keys[0].encPrivateKey }]);
      publicKeys = [arrayToBase64(keyPair.publicKey)];
    }

    const vaultId = await this.api.initContractId({
      [protocolTags.NODE_TYPE]: objectTypes.VAULT,
    });
    this.setCommand(commands.VAULT_CREATE);
    this.setVaultId(vaultId);
    this.setObjectId(vaultId);

    const address = await this.wallet.getAddress();
    const membershipId = uuidv4();

    this.tags = {
      [protocolTags.MEMBER_ADDRESS]: address,
      [protocolTags.MEMBERSHIP_ID]: membershipId,
      "Public": isPublic ? "true" : "false",
      ...await this.getTags()
    }

    const vaultData = {
      name: await this.processWriteString(name),
      termsOfAccess: jsonToBase64({
        termsOfAccess: termsOfAccess,
        hasTerms: !!termsOfAccess
      }),
    }
    const vaultSignature = await this.signData(vaultData);
    const membershipData = {
      keys,
      encPublicSigningKey: [await this.processWriteString(await this.wallet.signingPublicKey())],
      memberDetails: await this.processMemberDetails(memberDetails, true)
    }
    const membershipSignature = await this.signData(membershipData);
    const ids = await this.api.uploadData([
      {
        body: vaultData, tags: {
          "Data-Type": "State",
          [protocolTags.SIGNATURE]: vaultSignature,
          [protocolTags.SIGNER_ADDRESS]: this.tags[protocolTags.SIGNER_ADDRESS],
          [protocolTags.VAULT_ID]: this.tags[protocolTags.VAULT_ID],
          [protocolTags.NODE_TYPE]: objectTypes.VAULT,
        }
      },
      {
        body: membershipData, tags: {
          "Data-Type": "State",
          [protocolTags.SIGNATURE]: membershipSignature,
          [protocolTags.SIGNER_ADDRESS]: this.tags[protocolTags.SIGNER_ADDRESS],
          [protocolTags.VAULT_ID]: this.tags[protocolTags.VAULT_ID],
          [protocolTags.NODE_TYPE]: objectTypes.MEMBERSHIP,
          [protocolTags.MEMBERSHIP_ID]: membershipId,
        }
      }], true);
    const metadata = {
      dataRefs: [
        { ...ids[0], modelId: this.vaultId, modelType: objectTypes.VAULT, data: vaultData },
        { ...ids[1], modelId: membershipId, modelType: objectTypes.MEMBERSHIP, data: membershipData }
      ],
      publicKeys
    }
    const data = { vault: ids[0].id, membership: ids[1].id };

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      { function: this.command, data },
      this.tags,
      { ...metadata, ...this.metadata() }
    );
    return { vaultId, membershipId, transactionId: txId }
  }

  /**
   * @param vaultId
   * @param name new vault name
   * @returns Promise with corresponding transaction id
   */
  public async rename(vaultId: string, name: string): Promise<{ transactionId: string }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_RENAME);
    return this.nodeRename(name);
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding transaction id
   */
  public async archive(vaultId: string): Promise<{ transactionId: string }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_ARCHIVE);
    this.setCommand(commands.VAULT_ARCHIVE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding transaction id
   */
  public async restore(vaultId: string): Promise<{ transactionId: string }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_RESTORE);
    this.setCommand(commands.VAULT_RESTORE);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with corresponding transaction id
   */
  public async delete(vaultId: string): Promise<{ transactionId: string }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.VAULT_DELETE);
    const header = {
      schemaUri: 'akord:dataroom:delete',
      ...await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { status: "DELETED" }
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with the decrypted vault
   */
  public async get(vaultId: string, shouldDecrypt = true): Promise<any> {
    const object = await this.api.getObject(vaultId, this.objectType);
    await this.setVaultContext(object.id);
    return this.processObject(object, shouldDecrypt);
  }

  /**
   * @returns Promise with currently authenticated user vaults
   */
  public async list(shouldDecrypt = true): Promise<any> {
    const vaults = await this.api.getVaults(this.wallet);
    let vaultTable = [];
    for (let vaultId of vaults) {
      await this.setVaultContext(vaultId);
      const processedVault = await this.processObject(this.vault, shouldDecrypt);
      vaultTable.push(processedVault);
    }
    return vaultTable;
  }

  public async setVaultContext(vaultId: string): Promise<void> {
    await super.setVaultContext(vaultId);
    this.setPrevHash(this.vault.hash);
    this.setObjectId(vaultId);
  }

  public async processObject(object: any, shouldDecrypt = true): Promise<any> {
    const processedObject = await super.processObject(object, shouldDecrypt);
    if (processedObject.termsOfAccess) {
      const terms = base64ToJson(processedObject.termsOfAccess);
      processedObject.termsOfAccess = terms.termsOfAccess;
    }
    return processedObject;
  }
};

export {
  VaultService
}