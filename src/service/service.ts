import { ServiceInterface } from '.';
import { Api } from "../api";
import {
  Wallet,
  EncrypterFactory,
  fromProfileState,
  Encrypter,
  EncryptionKeys,
  digestRaw,
  signString,
  jsonToBase64,
  base64ToArray,
  arrayToString,
  stringToArray,
  arrayToBase64,
  base64ToJson
} from "@akord/crypto"
import * as mime from "mime-types";
import { reactionEmoji } from '../constants';
import { protocolTags } from './protocol/protocol-constants';
import lodash from "lodash";
import { createThumbnail } from './thumbnail'

declare const Buffer;
class Service implements ServiceInterface {
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
  membershipInviteNewUserResend(): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  membershipInviteResend(): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  vaultDelete(): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  profileUpdate(name: string, avatar: any): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  stackCreate(name: string, file: any, parentId?: string, progressHook?: (progress: number) => void): Promise<{ stackId: string; transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  stackUploadRevision(file: any, progressHook?: (progress: number) => void): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  noteCreate(name: string, content: string, parentId?: string): Promise<{ noteId: string; transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  membershipProfileUpdate(name: string, avatar: any): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  vaultCreate(name: string, termsOfAccess: string, memberDetails: any, isPublic?: boolean): Promise<{ vaultId: string; membershipId: string; transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  vaultArchive(): Promise<{
    transactionId: string; // for the data encryption
  }> {
    throw new Error('Method not implemented.');
  }
  membershipInvite(email: string, role: string): Promise<{ membershipId: string; transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  membershipAccept(memberDetails: any): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  membershipReject(): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  membershipRevoke(): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  membershipChangeRole(role: string): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  membershipInviteNewUser(email: string, role: string): Promise<{ membershipId: string; transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  membershipConfirm(): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  nodeRevoke(): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  nodeRestore(): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  nodeDelete(): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  nodeMove(parentId?: string): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  nodeRename(name: string): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  folderCreate(name: string, parentId?: string): Promise<{ folderId: string; transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  noteUploadRevision(name: string, content: string): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  memoCreate(message: string): Promise<{ memoId: string; transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  memoAddReaction(reaction: reactionEmoji, author: string): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }
  memoRemoveReaction(reaction: reactionEmoji): Promise<{ transactionId: string; }> {
    throw new Error('Method not implemented.');
  }

  setKeys(keys: any) {
    this.dataEncrypter.setKeys(keys);
    this.keysEncrypter.setKeys(keys);
  }

  setVaultId(vaultId: string) {
    this.vaultId = vaultId;
  }

  setObjectId(objectId: string) {
    this.objectId = objectId;
  }

  setObjectType(objectType: string) {
    this.objectType = objectType;
  }

  setCommand(command: string) {
    this.command = command;
  }

  setActionRef(actionRef: string) {
    this.actionRef = actionRef;
  }

  setGroupRef(groupRef: string) {
    this.groupRef = groupRef;
  }

  setPrevHash(hash: string) {
    this.prevHash = hash;
  }

  setIsPublic(isPublic: boolean) {
    this.isPublic = isPublic;
  }

  setVault(vault: any) {
    this.vault = vault;
  }

  setObject(object: any) {
    this.object = object;
  }

  setRawDataEncryptionPublicKey(publicKey) {
    this.dataEncrypter.setRawPublicKey(publicKey);
  }

  setDataEncryptionPublicKey(publicKey) {
    this.dataEncrypter.setPublicKey(publicKey);
  }

  setKeysEncryptionPublicKey(publicKey) {
    this.keysEncrypter.setPublicKey(publicKey);
  }

  setRawKeysEncryptionPublicKey(publicKey) {
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

  async _getReactionIndex(reactions: any[], reaction: string) {
    const publicSigningKey = await this.wallet.signingPublicKey();
    for (const [key, value] of Object.entries(reactions)) {
      if ((<any>value).status === 'ACTIVE'
        && (<any>value).publicSigningKey === publicSigningKey
        && reaction === await this.processReadString((<any>value).reaction)) {
        return <any>(<unknown>key);
      }
    }
    return -1;
  }

  async getReaction(reaction: string) {
    const index = await this._getReactionIndex(this.object.state.reactions, reaction);
    if (index < 0) {
      throw new Error("Could not find reaction: " + reaction + " for given user.")
    }
    const reactionObject = this.object.state.reactions[index];
    delete reactionObject.__typename;
    return reactionObject;
  }

  async _uploadFile(file: any, shouldBundleTransaction?: boolean, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{ resourceTx: string, resourceUrl: string }> {
    let tags = {};
    if (this.isPublic) {
      const hash = await digestRaw(file.data);
      tags['File-Hash'] = hash;
      tags['File-Name'] = encodeURIComponent(file.name);
      if (file.lastModified) {
        tags['File-Modified-At'] = file.lastModified.toString();
      }
    }
    const { processedData, encryptionTags } = await this.processWriteRaw(file.data);
    const mimeType = mime.lookup(file.name);
    if (!file.type) {
      try {
        file.type = mimeType;
      } catch (e) {
        file = file.slice(0, file.size, mimeType);
      }
    }
    tags['Content-Type'] = mimeType;
    tags['File-Size'] = file.size;
    tags['File-Type'] = file.type;
    tags['Timestamp'] = JSON.stringify(Date.now());
    return this.api.uploadFile(processedData, { ...tags, ...encryptionTags }, this.isPublic, shouldBundleTransaction, progressHook, cancelHook);
  }

  async _postFile(file: any, progressHook?: (progress: number) => void, cancelHook?: AbortController)
    : Promise<{ resourceTx: string, resourceUrl: string, thumbnailTx?: string, thumbnailUrl?: string }> {

    const filePromise = this._uploadFile(file, true, progressHook, cancelHook);
    try {
      const thumbnail = await createThumbnail(file);
      if (thumbnail) {
        const thumbnailPromise = this._uploadFile(thumbnail, false, progressHook);
        const results = await Promise.all([filePromise, thumbnailPromise]);
        return {
          resourceTx: results[0].resourceTx,
          resourceUrl: results[0].resourceUrl,
          thumbnailTx: results[1].resourceTx,
          thumbnailUrl: results[1].resourceUrl
        };
      } else {
        return await filePromise;
      }
    } catch (e) {
      console.log(e);
    }
  }

  async processWriteRaw(data: any) {
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

  async _getActiveKey() {
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

  async processWriteString(data: string) {
    if (this.isPublic) return data;
    const encryptedPayload = await this.dataEncrypter.encryptRaw(stringToArray(data));
    const decodedPayload = base64ToJson(encryptedPayload);
    decodedPayload.publicKeyIndex = (await this._getActiveKey()).index;
    delete decodedPayload.publicKey;
    return jsonToBase64(decodedPayload);
  }

  async processAvatar(avatar: any) {
    const { processedData, encryptionTags } = await this.processWriteRaw(avatar);
    return this.api.uploadFile(processedData, encryptionTags, false, true);
  }

  async processMemberDetails(memberDetails: any) {
    let processedMemberDetails = {} as any;
    if (memberDetails.fullName) {
      processedMemberDetails.fullName = await this.processWriteString(memberDetails.fullName);
    }
    if (memberDetails.avatar) {
      const { resourceUrl, resourceTx } = await this.processAvatar(memberDetails.avatar);
      processedMemberDetails.avatarUrl = resourceUrl;
      processedMemberDetails.avatarTx = resourceTx;
    }
    return processedMemberDetails;
  }

  async processReadObject(object: any, fieldsToDecrypt: any) {
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

  async processReadString(data: any) {
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

  _getEncryptedData(data: any, headers: any) {
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

  async _mergeAndUploadBody(body: any) {
    const mergedBody = await this.mergeState(this.objectId, this.objectType, body);
    return this._uploadBody(mergedBody);
  }

  async signData(data: any) {
    const encodedBody = jsonToBase64(data)
    const privateKeyRaw = await this.wallet.signingPrivateKeyRaw()
    const signature = await signString(
      encodedBody,
      privateKeyRaw
    )
    return signature;
  }

  async _uploadBody(body: any) {
    const signature = await this.signData(body);
    const ids = await this.api.uploadData([{
      body, tags: {
        [protocolTags.SIGNATURE]: signature,
        [protocolTags.SIGNER_ADDRESS]: this.tags[protocolTags.SIGNER_ADDRESS]
      }
    }]);
    const metadata = {
      dataRefs: [
        { ...ids[0], modelId: this.objectId, modelType: this.objectType }
      ]
    }
    const data = ids[0].id;
    return { metadata, data }
  }

  async mergeState(objectId: string, objectType: string, stateUpdates: any) {
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
}

export {
  Service
}