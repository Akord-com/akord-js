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
} from "@akord/crypto";
import { v4 as uuidv4 } from "uuid";
import { objectTypes, protocolTags, commands } from '../constants';
import lodash from "lodash";

declare const Buffer;

class Service {
  api: Api
  wallet: Wallet

  dataEncrypter: Encrypter
  keysEncrypter: Encrypter

  prevHash: string
  vaultId: string
  objectId: string
  objectType: string
  command: string
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
    this.setIsPublic(vault.state?.isPublic);
    if (!this.isPublic) {
      const encryptionKeys = await this.api.getMembershipKeys(vaultId, this.wallet);
      this.setKeys(encryptionKeys.keys);
      this.setRawDataEncryptionPublicKey(encryptionKeys?.getPublicKey());
    }
  }

  protected async setVaultContextFromObjectId(objectId: string, objectType: string) {
    const object = await this.api.getObject(objectId, objectType);
    await this.setVaultContext(object.dataRoomId);
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
  public async decryptState<T>(state: T): Promise<T> {
    const decryptedState = await this.processReadObject(state, ["title", "name", "message", "content"]);
    if (decryptedState.files && decryptedState.files.length > 0) {
      for (const [index, file] of decryptedState.files.entries()) {
        const decryptedFile = await this.processReadObject(file, ["title", "name"]);
        delete decryptedFile.__typename;
        decryptedState.files[index] = decryptedFile;
      }
    }
    if (decryptedState.reactions && decryptedState.reactions.length > 0) {
      for (const [index, reaction] of decryptedState.reactions.entries()) {
        const decryptedReaction = await this.processReadObject(reaction, ["reaction"]);
        delete decryptedReaction.__typename;
        decryptedState.reactions[index] = decryptedReaction;
      }
    }
    if (decryptedState.revisions && decryptedState.revisions.length > 0) {
      for (const [index, revision] of decryptedState.revisions.entries()) {
        const decryptedRevision = await this.processReadObject(revision, ["content", "title"]);
        delete decryptedRevision.__typename;
        decryptedState.revisions[index] = decryptedRevision;
      }
    }
    if (decryptedState.memberDetails) {
      const decryptedMemberDetails = await this.processReadObject(decryptedState.memberDetails, ["fullName"]);
      delete decryptedMemberDetails.__typename;
      decryptedState.memberDetails = decryptedMemberDetails;
    }
    delete decryptedState.__typename;
    return decryptedState;
  }

  protected async nodeRename(name: string): Promise<{ transactionId: string }> {
    const body = {
      name: await this.processWriteString(name)
    };
    this.setCommand(this.objectType === "Vault" ? commands.VAULT_UPDATE : commands.NODE_UPDATE);
    return this.nodeUpdate(body);
  }

  protected async nodeUpdate(body?: any, clientInput?: any, clientMetadata?: any): Promise<{ transactionId: string }> {
    const input = {
      function: this.command,
      ...clientInput
    };

    this.tags = await this.getTags();

    if (body) {
      const { data, metadata } = await this._mergeAndUploadBody(body);
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
    this.setCommand(commands.NODE_CREATE);

    this.tags = await this.getTags();

    const { metadata, data } = await this._uploadBody(body);

    const input = {
      function: this.command,
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

  protected setCommand(command: string) {
    this.command = command;
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

  protected setRawDataEncryptionPublicKey(publicKey) {
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

  async getProfileDetails() {
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
        const encryptedData = this._getEncryptedData(fileData, headers);
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

  protected async processWriteRaw(data: any) {
    let processedData: any;
    const encryptionTags = {};
    if (this.isPublic) {
      processedData = data;
    } else {
      const encryptedFile = await this.dataEncrypter.encryptRaw(data, false);
      processedData = encryptedFile.encryptedData.ciphertext;
      encryptionTags['Initialization-Vector'] = encryptedFile.encryptedData.iv;
      encryptionTags['Encrypted-Key'] = encryptedFile.encryptedKey;
      encryptionTags['Public-Key-Index'] = (await this._getActiveKey()).index;
      encryptionTags['Public-Key'] = (await this._getActiveKey()).publicKey;
    }
    return { processedData, encryptionTags }
  }

  protected async _getActiveKey() {
    await (<any>this.dataEncrypter)._decryptKeys();
    const activePublicKey = arrayToBase64(<any>this.dataEncrypter.publicKey);
    const activeKeyIndex = this.dataEncrypter.decryptedKeys.findIndex(
      key => (key.publicKey === activePublicKey)
    )
    if (activeKeyIndex === -1) {
      for (const [i, keyPair] of this.dataEncrypter.decryptedKeys.entries()) {
        if (arrayToBase64(await this.wallet.decrypt(keyPair.publicKey))
          === activePublicKey)
          return {
            index: i,
            publicKey: activePublicKey
          };;
      }
    }
    return {
      index: activeKeyIndex,
      publicKey: activePublicKey
    };
  }

  protected async processWriteString(data: string) {
    if (this.isPublic) return data;
    const encryptedPayload = await this.dataEncrypter.encryptRaw(stringToArray(data));
    const decodedPayload = base64ToJson(encryptedPayload);
    decodedPayload.publicKeyIndex = (await this._getActiveKey()).index;
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

  protected async processReadObject(object: any, fieldsToDecrypt: any) {
    if (this.isPublic) return object;
    const decryptedObject = object;
    const promises = fieldsToDecrypt.map(async fieldName => {
      if (decryptedObject[fieldName] && decryptedObject[fieldName] !== '') {
        const decryptedFieldValue = await this.dataEncrypter.decryptRaw(decryptedObject[fieldName]);
        decryptedObject[fieldName] = arrayToString(decryptedFieldValue);
      }
    })
    return Promise.all(promises).then(() => decryptedObject);
  }

  protected async processReadString(data: any) {
    if (this.isPublic) return data;
    const decryptedDataRaw = await this.processReadRaw(data, {});
    return arrayToString(decryptedDataRaw);
  }

  async processReadRaw(data: any, headers: any) {
    if (this.isPublic) {
      return Buffer.from(data.data);
    }

    const encryptedData = this._getEncryptedData(data, headers);
    if (encryptedData) {
      return this.dataEncrypter.decryptRaw(encryptedData, false);
    } else {
      return this.dataEncrypter.decryptRaw(data);
    }
  }

  protected _getEncryptedData(data: any, headers: any) {
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

  protected async _mergeAndUploadBody(body: any) {
    const mergedBody = await this.mergeState(this.objectId, this.objectType, body);
    return this._uploadBody(mergedBody);
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

  protected async _uploadBody(body: any) {
    const signature = await this.signData(body);
    const tags = {
      "Data-Type": "State",
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
        { ...ids[0], modelId: this.objectId, modelType: this.objectType }
      ]
    }
    const data = ids[0].id;
    return { metadata, data }
  }

  protected async mergeState(objectId: string, objectType: string, stateUpdates: any) {
    const currentState = await this.api.getNodeState(objectId, objectType, this.vaultId);
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

  protected async getUserEncryptionInfo(email?: string, address?: string) {
    if (email) {
      const { address, publicKey } = await this.api.getUserFromEmail(email);
      return { address, publicKey: base64ToArray(publicKey) }
    } else {
      const publicKey = await (<ArweaveWallet>this.wallet).getPublicKeyFromAddress(address);
      return { address, publicKey }
    }
  }

  protected async getTags() {
    const tags = {
      [protocolTags.COMMAND]: this.command,
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