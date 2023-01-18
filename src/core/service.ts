import { Api } from "../api/api";
import {
  Wallet,
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
  AkordWallet,
} from "@akord/crypto";
import { v4 as uuidv4 } from "uuid";
import { objectTypes, protocolTags, functions, dataTags, encryptionTags } from '../constants';
import lodash from "lodash";
import { Vault } from "../types/vault";
import { Tag, Tags } from "../types/contract";
import { NodeLike } from "../types/node";
import { Membership } from "../types/membership";

declare const Buffer;

class Service {
  api: Api
  wallet: Wallet

  dataEncrypter: Encrypter
  membershipKeys: any

  vaultId: string
  objectId: string
  objectType: string
  function: functions
  isPublic: boolean
  vault: Vault
  object: NodeLike | Membership | Vault
  actionRef: string
  groupRef: string
  tags: Tags

  constructor(wallet: Wallet, api: Api, encryptionKeys?: EncryptionKeys) {
    this.wallet = wallet
    this.api = api
    // for the data encryption
    this.dataEncrypter = new EncrypterFactory(
      wallet,
      encryptionKeys
    ).encrypterInstance()
  }

  protected async setVaultContext(vaultId: string) {
    const vault = await this.api.getObject<Vault>(vaultId, objectTypes.VAULT, vaultId);
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    await this.setMembershipKeys(vaultId);
  }


  protected async setVaultContextFromObjectId(objectId: string, objectType: string, vaultId?: string) {
    const object = await this.api.getObject<any>(objectId, objectType, this.vaultId);
    await this.setVaultContext(vaultId || object.vaultId);
    this.setObject(object);
    this.setObjectId(objectId);
    this.setObjectType(objectType);
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
      if (encryptionKeys.publicKey) {
        this.setRawDataEncryptionPublicKey(base64ToArray(encryptionKeys.publicKey));
      } else {
        const publicKey = await this.dataEncrypter.wallet.decrypt(encryptionKeys.keys[encryptionKeys.keys.length - 1].encPublicKey);
        this.setRawDataEncryptionPublicKey(publicKey);
      }
    }
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
      clientMetadata
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

    const { metadata, data } = await this.uploadState(body);

    const input = {
      function: this.function,
      data,
      ...clientInput
    };
    const txId = await this.api.postContractTransaction(
      this.vaultId,
      input,
      this.tags,
      { ...metadata, ...clientMetadata }
    );
    this.setActionRef(null);
    return { nodeId, transactionId: txId };
  }

  setKeys(keys: any) {
    this.membershipKeys = keys;
    this.dataEncrypter.setKeys(keys);
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

  protected setFunction(functionName: functions) {
    this.function = functionName;
  }

  protected setActionRef(actionRef: string) {
    this.actionRef = actionRef;
  }

  setGroupRef(groupRef: string) {
    this.groupRef = groupRef;
  }

  setIsPublic(isPublic: boolean) {
    this.isPublic = isPublic;
  }

  setVault(vault: Vault) {
    this.vault = vault;
  }

  protected setObject(object: NodeLike | Membership | Vault) {
    this.object = object;
  }

  setRawDataEncryptionPublicKey(publicKey) {
    this.dataEncrypter.setRawPublicKey(publicKey);
  }

  protected async getProfileDetails() {
    const profile = await this.api.getProfile(this.wallet);
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
      if (profileDetails.avatarUrl && profileDetails.avatarUri.length) {
        const resourceTx = [...profileDetails.avatarUri].reverse().find(resourceUri => resourceUri.startsWith("s3:"))?.replace("s3:", "")
        const { fileData, headers } = await this.api.downloadFile(resourceTx);
        const encryptedData = this.getEncryptedData(fileData, headers);
        if (encryptedData) {
          avatar = await profileEncrypter.decryptRaw(encryptedData, false);
        } else {
          const dataString = arrayToString(new Uint8Array(fileData.data));
          avatar = await profileEncrypter.decryptRaw(dataString, true);
        }
      }
      const decryptedProfile = await profileEncrypter.decryptObject(
        profileDetails,
        ['fullName', 'name', 'phone'],
      );
      decryptedProfile.name = decryptedProfile.name || decryptedProfile.fullName;
      delete decryptedProfile.fullName;
      return { ...decryptedProfile, avatar }
    }
    return {};
  }

  protected async processWriteRaw(data: any, encryptedKey?: string) {
    let processedData: any;
    const tags = [] as Tags;
    if (this.isPublic) {
      processedData = data;
    } else {
      const encryptedFile = await this.dataEncrypter.encryptRaw(data, false, encryptedKey);
      processedData = encryptedFile.encryptedData.ciphertext;
      const { address, publicKey } = await this.getActiveKey();
      tags.push(new Tag(encryptionTags.IV, encryptedFile.encryptedData.iv))
      tags.push(new Tag(encryptionTags.ENCRYPTED_KEY, encryptedFile.encryptedKey))
      tags.push(new Tag(encryptionTags.PUBLIC_ADDRESS, address))
    }
    return { processedData, encryptionTags: tags }
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
    if (memberDetails.name) {
      processedMemberDetails.name = await this.processWriteString(memberDetails.name);
    }
    if (memberDetails.avatar) {
      const { resourceUrl, resourceTx } = await this.processAvatar(memberDetails.avatar, shouldBundleTransaction);
      processedMemberDetails.avatarUri = [`arweave:${resourceTx}`, `s3:${resourceUrl}`];
    }
    return processedMemberDetails;
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
    return this.uploadState(mergedBody);
  }

  protected async signData(data: any) {
    if (this.wallet instanceof AkordWallet) {
      const encodedBody = jsonToBase64(data)
      const privateKeyRaw = await this.wallet.signingPrivateKeyRaw()
      const signature = await signString(
        encodedBody,
        privateKeyRaw
      )
      return signature;
    } else {
      return "--TODO--"
    }
  }

  protected async uploadState(state: any) {
    const signature = await this.signData(state);
    const tags = [
      new Tag(dataTags.DATA_TYPE, "State"),
      new Tag(protocolTags.SIGNATURE, signature),
      new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()),
      new Tag(protocolTags.VAULT_ID, this.vaultId),
      new Tag(protocolTags.NODE_TYPE, this.objectType),
    ]
    if (this.objectType === objectTypes.MEMBERSHIP) {
      tags.push(new Tag(protocolTags.MEMBERSHIP_ID, this.objectId))
    } else if (this.objectType !== objectTypes.VAULT) {
      tags.push(new Tag(protocolTags.NODE_ID, this.objectId))
    }
    const ids = await this.api.uploadData([{ data: state, tags }], true);
    const metadata = {
      dataRefs: [
        { ...ids[0], modelId: this.objectId, modelType: this.objectType, data: state }
      ]
    }
    const data = ids[0].id;
    return { metadata, data }
  }

  protected async mergeState(stateUpdates: any) {
    const currentState = this.object.data ? await this.api.getNodeState(this.object.data[this.object.data.length - 1]) : {};
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

  protected async getTags(): Promise<Tags> {
    const tags = [
      new Tag(protocolTags.FUNCTION_NAME, this.function),
      new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()),
      new Tag(protocolTags.VAULT_ID, this.vaultId),
      new Tag(protocolTags.TIMESTAMP, JSON.stringify(Date.now())),
      new Tag(protocolTags.NODE_TYPE, this.objectType),
    ]
    if (this.groupRef) {
      tags.push(new Tag("Group-Ref", this.groupRef));
    }
    if (this.actionRef) {
      tags.push(new Tag("Action-Ref", this.actionRef));
    }
    if (this.objectType === objectTypes.MEMBERSHIP) {
      tags.push(new Tag(protocolTags.MEMBERSHIP_ID, this.objectId));
    } else if (this.objectType !== objectTypes.VAULT) {
      tags.push(new Tag(protocolTags.NODE_ID, this.objectId));
    }
    return tags;
  }

  protected async prepareHeader() {
    const header = {
      prevHash: this.object?.hash,
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