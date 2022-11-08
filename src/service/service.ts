import { Api } from "../api";
import {
  Wallet,
  ArweaveWallet,
  EncrypterFactory,
  fromProfileState,
  Encrypter,
  EncryptionKeys,
  signString,
  jsonToBase64,
  base64ToArray,
  arrayToString,
  stringToArray,
  arrayToBase64,
  base64ToJson,
  deriveAddress,
} from "@akord/crypto";
import { v4 as uuidv4 } from "uuid";
import { objectTypes, protocolTags, functions, dataTags } from '../constants';
import lodash from "lodash";
import { EncryptionTags } from "../types/encryption-tags";

declare const Buffer;

class Service {
  api: Api
  wallet: Wallet

  dataEncrypter: Encrypter
  keysEncrypter: Encrypter
  membershipKeys: any

  prevHash: string
  vaultId: string
  objectId: string
  objectType: string
  function: string
  isPublic: boolean
  vault: any
  object: any
  actionRef: string
  groupRef: string
  tags: any

  constructor(wallet: Wallet, api: Api, encryptionKeys?: EncryptionKeys) {
    this.wallet = wallet
    this.api = api
    // for the data encryption
    this.dataEncrypter = new EncrypterFactory(
      wallet,
      encryptionKeys
    ).encrypterInstance()
    // for the member keys encryption
    this.keysEncrypter = new EncrypterFactory(
      wallet,
      encryptionKeys
    ).encrypterInstance()
  }

  protected async setVaultContext(vaultId: string) {
    const vault = await this.api.getObject(vaultId, objectTypes.VAULT);
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    await this.setMembershipKeys(vaultId);
  }

  protected async setMembershipKeys(vaultId: string) {
    if (!this.isPublic) {
      const encryptionKeys = await this.api.getMembershipKeys(vaultId, this.wallet);
      const keys = encryptionKeys.keys.map(((keyPair: any) => {
        return {
          encPrivateKey: keyPair.encPrivateKey,
          publicKey: keyPair.publicKey ? keyPair.publicKey : keyPair.encPublicKey
        }
      }))
      this.setKeys(keys);
      if (encryptionKeys.keys[encryptionKeys.keys.length - 1].encPublicKey) {
        const publicKey = await this.keysEncrypter.wallet.decrypt(encryptionKeys.keys[encryptionKeys.keys.length - 1].encPublicKey);
        this.setRawDataEncryptionPublicKey(publicKey);
      } else {
        this.setRawDataEncryptionPublicKey(encryptionKeys?.getPublicKey());
      }
    }
  }

  protected async setVaultContextFromObjectId(objectId: string, objectType: string) {
    const object = await this.api.getObject(objectId, objectType);
    await this.setVaultContext(object.vaultId);
    this.setPrevHash(object.hash);
    this.setObject(object);
    this.setObjectId(objectId);
    this.setObjectType(objectType);
  }

  /**
  * Decrypt given state (require encryption context)
  * @param  {any} state
  * @returns Promise with decrypted state
  */
  public async processState<T>(state: T, shouldDecrypt = true): Promise<T> {
    const decryptedState = await this.processReadObject(state, ["title", "name", "message", "content"], shouldDecrypt);
    if (decryptedState.files && decryptedState.files.length > 0) {
      for (const [index, file] of decryptedState.files.entries()) {
        const decryptedFile = await this.processReadObject(file, ["title", "name"], shouldDecrypt);
        delete decryptedFile.__typename;
        decryptedState.files[index] = decryptedFile;
      }
    }
    if (decryptedState.versions && decryptedState.versions.length > 0) {
      for (const [index, version] of decryptedState.versions.entries()) {
        const decryptedVersion = await this.processReadObject(version, ["title", "name", "message", "content"], shouldDecrypt);
        delete decryptedVersion.__typename;
        if (decryptedVersion.reactions && decryptedVersion.reactions.length > 0) {
          for (const [index, reaction] of decryptedVersion.reactions.entries()) {
            const decryptedReaction = await this.processReadObject(reaction, ["reaction"], shouldDecrypt);
            delete decryptedReaction.__typename;
            decryptedVersion.reactions[index] = decryptedReaction;
          }
        }
        decryptedState.versions[index] = decryptedVersion;
      }
    }
    if (decryptedState.reactions && decryptedState.reactions.length > 0) {
      for (const [index, reaction] of decryptedState.reactions.entries()) {
        const decryptedReaction = await this.processReadObject(reaction, ["reaction"], shouldDecrypt);
        delete decryptedReaction.__typename;
        decryptedState.reactions[index] = decryptedReaction;
      }
    }
    if (decryptedState.revisions && decryptedState.revisions.length > 0) {
      for (const [index, revision] of decryptedState.revisions.entries()) {
        const decryptedRevision = await this.processReadObject(revision, ["content", "title"], shouldDecrypt);
        delete decryptedRevision.__typename;
        decryptedState.revisions[index] = decryptedRevision;
      }
    }
    if (decryptedState.memberDetails) {
      const decryptedMemberDetails = await this.processReadObject(decryptedState.memberDetails, ["fullName"], shouldDecrypt);
      delete decryptedMemberDetails.__typename;
      decryptedState.memberDetails = decryptedMemberDetails;
    }
    delete decryptedState.__typename;
    return decryptedState;
  }

  public async processObject(object: any, shouldDecrypt = true) {
    return this.processState(object, shouldDecrypt);
  }

  protected async nodeRename(name: string): Promise<{ transactionId: string }> {
    const body = {
      name: await this.processWriteString(name)
    };
    this.setFunction(this.objectType === "Vault" ? functions.VAULT_UPDATE : functions.NODE_UPDATE);
    return this.nodeUpdate(body);
  }

  protected async nodeUpdate(body?: any, clientInput?: any, clientMetadata?: any): Promise<{ transactionId: string }> {
    const input = {
      function: this.function,
      ...clientInput
    };

    this.tags = await this.getTags();

    if (body) {
      const { data, metadata } = await this.mergeAndUploadBody(body);
      input.data = data;
      clientMetadata = {
        ...clientMetadata,
        ...metadata
      }
    }
    const txId = await this.api.postContractTransaction(
      this.vaultId,
      input,
      this.tags,
      { ...clientMetadata, ...this.metadata() }
    );
    return { transactionId: txId }
  }

  protected async nodeCreate(body?: any, clientInput?: any, clientMetadata?: any): Promise<{
    nodeId: string,
    transactionId: string
  }> {
    const nodeId = uuidv4();
    this.setObjectId(nodeId);
    this.setFunction(functions.NODE_CREATE);

    this.tags = await this.getTags();

    const { metadata, data } = await this.uploadBody(body);

    const input = {
      function: this.function,
      data,
      ...clientInput
    };
    const txId = await this.api.postContractTransaction(
      this.vaultId,
      input,
      this.tags,
      { ...metadata, ...clientMetadata, ...this.metadata() }
    );
    return { nodeId, transactionId: txId };
  }

  setKeys(keys: any) {
    this.membershipKeys = keys;
    this.dataEncrypter.setKeys(keys);
    this.keysEncrypter.setKeys(keys);
  }

  setVaultId(vaultId: string) {
    this.vaultId = vaultId;
  }

  protected setObjectId(objectId: string) {
    this.objectId = objectId;
  }

  protected setObjectType(objectType: string) {
    this.objectType = objectType;
  }

  protected setFunction(functionName: string) {
    this.function = functionName;
  }

  protected setActionRef(actionRef: string) {
    this.actionRef = actionRef;
  }

  setGroupRef(groupRef: string) {
    this.groupRef = groupRef;
  }

  protected setPrevHash(hash: string) {
    this.prevHash = hash;
  }

  setIsPublic(isPublic: boolean) {
    this.isPublic = isPublic;
  }

  setVault(vault: any) {
    this.vault = vault;
  }

  protected setObject(object: any) {
    this.object = object;
  }

  setRawDataEncryptionPublicKey(publicKey) {
    this.dataEncrypter.setRawPublicKey(publicKey);
  }

  protected setDataEncryptionPublicKey(publicKey) {
    this.dataEncrypter.setPublicKey(publicKey);
  }

  protected setKeysEncryptionPublicKey(publicKey) {
    this.keysEncrypter.setPublicKey(publicKey);
  }

  protected setRawKeysEncryptionPublicKey(publicKey) {
    this.keysEncrypter.setRawPublicKey(publicKey);
  }

  protected async getProfileDetails() {
    const signingPublicKey = await this.wallet.signingPublicKey();
    const profile = await this.api.getProfileByPublicSigningKey(signingPublicKey);
    if (profile) {
      const profileKeys = fromProfileState(profile.state)
      const profileEncrypter = new EncrypterFactory(this.wallet, profileKeys).encrypterInstance()
      profileEncrypter.decryptedKeys = [
        {
          publicKey: await this.wallet.publicKey(),
          privateKey: this.wallet.privateKeyRaw()
        }
      ]
      let profileDetails = profile.state.profileDetails;
      delete profileDetails.__typename;
      let avatar = null;
      if (profileDetails.avatarUrl) {
        const { fileData, headers } = await this.api.downloadFile(profileDetails.avatarUrl);
        const encryptedData = this.getEncryptedData(fileData, headers);
        if (encryptedData) {
          avatar = await profileEncrypter.decryptRaw(encryptedData, false);
        } else {
          const dataString = arrayToString(new Uint8Array(fileData.data));
          avatar = await profileEncrypter.decryptRaw(dataString, true);
        }
      }
      return {
        ...await profileEncrypter.decryptObject(
          profileDetails,
          ['fullName', 'phone'],
        ),
        avatar
      }
    }
    return {};
  }

  protected async processWriteRaw(data: any, encryptedKey?: string) {
    let processedData: any;
    let encryptionTags: EncryptionTags;
    if (this.isPublic) {
      processedData = data;
    } else {
      const encryptedFile = await this.dataEncrypter.encryptRaw(data, false, encryptedKey);
      processedData = encryptedFile.encryptedData.ciphertext;
      const { address, publicKey } = await this.getActiveKey();
      encryptionTags = {
        'Initialization-Vector': encryptedFile.encryptedData.iv,
        'Encrypted-Key': encryptedFile.encryptedKey,
        'Public-Address': address,
        // 'Public-Key': publicKey
      }
    }
    return { processedData, encryptionTags }
  }

  protected async getActiveKey() {
    return {
      address: await deriveAddress(<any>this.dataEncrypter.publicKey, "akord"),
      publicKey: arrayToBase64(<any>this.dataEncrypter.publicKey)
    };
  }

  protected async processWriteString(data: string) {
    if (this.isPublic) return data;
    const encryptedPayload = await this.dataEncrypter.encryptRaw(stringToArray(data));
    const decodedPayload = base64ToJson(encryptedPayload);
    decodedPayload.publicAddress = (await this.getActiveKey()).address;
    delete decodedPayload.publicKey;
    return jsonToBase64(decodedPayload);
  }

  protected async processAvatar(avatar: any, shouldBundleTransaction?: boolean) {
    const { processedData, encryptionTags } = await this.processWriteRaw(avatar);
    return this.api.uploadFile(processedData, encryptionTags, false, shouldBundleTransaction);
  }

  protected async processMemberDetails(memberDetails: any, shouldBundleTransaction?: boolean) {
    let processedMemberDetails = {} as any;
    if (memberDetails.fullName) {
      processedMemberDetails.fullName = await this.processWriteString(memberDetails.fullName);
    }
    if (memberDetails.avatar) {
      const { resourceUrl, resourceTx } = await this.processAvatar(memberDetails.avatar, shouldBundleTransaction);
      processedMemberDetails.avatarUrl = resourceUrl;
      processedMemberDetails.avatarTx = resourceTx;
    }
    return processedMemberDetails;
  }

  protected async processReadObject(object: any, fieldsToDecrypt: any, shouldDecrypt = true) {
    const decryptedObject = object;
    if (decryptedObject.title) {
      decryptedObject.name = decryptedObject.title;
      delete decryptedObject.title;
    }
    if (this.isPublic || !shouldDecrypt) return decryptedObject;
    const promises = fieldsToDecrypt.map(async fieldName => {
      if (decryptedObject[fieldName] && decryptedObject[fieldName] !== '') {
        const decryptedFieldValue = await this.dataEncrypter.decryptRaw(decryptedObject[fieldName]);
        decryptedObject[fieldName] = arrayToString(decryptedFieldValue);
      }
    })
    return Promise.all(promises).then(() => decryptedObject);
  }

  protected async processReadString(data: any, shouldDecrypt = true) {
    if (this.isPublic || !shouldDecrypt) return data;
    const decryptedDataRaw = await this.processReadRaw(data, {});
    return arrayToString(decryptedDataRaw);
  }

  async processReadRaw(data: any, headers: any, shouldDecrypt = true) {
    if (this.isPublic || !shouldDecrypt) {
      return Buffer.from(data.data);
    }

    const encryptedData = this.getEncryptedData(data, headers);
    if (encryptedData) {
      return this.dataEncrypter.decryptRaw(encryptedData, false);
    } else {
      return this.dataEncrypter.decryptRaw(data);
    }
  }

  protected getEncryptedData(data: any, headers: any) {
    const encryptedKey = headers['x-amz-meta-encryptedkey'];
    const iv = headers['x-amz-meta-iv'];
    const publicKeyIndex = headers['x-amz-meta-public-key-index'];
    if (encryptedKey && iv) {
      return {
        encryptedKey,
        encryptedData: {
          iv: base64ToArray(iv),
          ciphertext: data
        },
        publicKeyIndex
      }
    }
    return null;
  }

  protected async mergeAndUploadBody(body: any) {
    const mergedBody = await this.mergeState(body);
    return this.uploadBody(mergedBody);
  }

  protected async signData(data: any) {
    const encodedBody = jsonToBase64(data)
    const privateKeyRaw = await this.wallet.signingPrivateKeyRaw()
    const signature = await signString(
      encodedBody,
      privateKeyRaw
    )
    return signature;
  }

  protected async uploadBody(body: any) {
    const signature = await this.signData(body);
    const tags = {
      [dataTags.DATA_TYPE]: "State",
      [protocolTags.SIGNATURE]: signature,
      [protocolTags.SIGNER_ADDRESS]: this.tags[protocolTags.SIGNER_ADDRESS],
      [protocolTags.VAULT_ID]: this.tags[protocolTags.VAULT_ID],
      [protocolTags.NODE_TYPE]: this.tags[protocolTags.NODE_TYPE],
    }
    if (this.objectType === objectTypes.MEMBERSHIP) {
      tags[protocolTags.MEMBERSHIP_ID] = this.tags[protocolTags.MEMBERSHIP_ID];
    } else if (this.objectType !== objectTypes.VAULT) {
      tags[protocolTags.NODE_ID] = this.tags[protocolTags.NODE_ID];
    }
    const ids = await this.api.uploadData([{ body, tags }], true);
    const metadata = {
      dataRefs: [
        { ...ids[0], modelId: this.objectId, modelType: this.objectType, data: body }
      ]
    }
    const data = ids[0].id;
    return { metadata, data }
  }

  protected async mergeState(stateUpdates: any) {
    const currentState = await this.api.getNodeState(this.object.data[this.object.data.length - 1]);
    let newState = lodash.cloneDeepWith(currentState);
    lodash.mergeWith(
      newState,
      stateUpdates,
      function concatArrays(objValue, srcValue) {
        if (lodash.isArray(objValue)) {
          return objValue.concat(srcValue);
        }
      });
    return newState;
  }

  protected async getUserEncryptionInfo(email?: string, userAddress?: string) {
    const { address, publicKey } = await this.api.getUserFromEmail(email || userAddress);
    return { address, publicKey: base64ToArray(publicKey) }
  }

  protected async getTags() {
    const tags = {
      [protocolTags.FUNCTION_NAME]: this.function,
      [protocolTags.SIGNER_ADDRESS]: await this.wallet.getAddress(),
      [protocolTags.VAULT_ID]: this.vaultId,
      [protocolTags.TIMESTAMP]: JSON.stringify(Date.now()),
      [protocolTags.NODE_TYPE]: this.objectType
    };
    if (this.objectType === objectTypes.MEMBERSHIP) {
      tags[protocolTags.MEMBERSHIP_ID] = this.objectId;
    } else if (this.objectType !== objectTypes.VAULT) {
      tags[protocolTags.NODE_ID] = this.objectId;
    }
    return tags;
  }

  protected metadata() {
    const metadata = {
      actionRef: this.actionRef,
      groupRef: this.groupRef
    };
    return metadata;
  }

  protected async prepareHeader() {
    const header = {
      prevHash: this.prevHash,
      publicSigningKey: await this.wallet.signingPublicKey(),
      postedAt: new Date(),
      groupRef: this.groupRef,
      actionRef: this.actionRef
    };
    return header;
  }

  /**
  * Post ledger transaction preparation
  * - encode & sign the transaction payload
  * @param {Object} headerPayload
  * @param {Object} bodyPayload
  */
  protected async encodeTransaction(header: any, body: any) {
    const privateKeyRaw = await this.wallet.signingPrivateKeyRaw()
    const publicKey = await this.wallet.signingPublicKey()

    // encode the header and body as BASE64 and sign it
    const encodedHeader = jsonToBase64(header)
    const encodedBody = jsonToBase64(body)
    const signature = await signString(
      `${encodedHeader}${encodedBody}`,
      privateKeyRaw
    )
    return { encodedHeader, encodedBody, publicKey, signature }
  }
}

export {
  Service
}