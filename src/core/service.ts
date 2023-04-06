import { Api } from "../api/api";
import {
  Wallet,
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
  EncryptedKeys
} from "@akord/crypto";
import { objectType, protocolTags, functions, dataTags, encryptionTags, smartweaveTags } from '../constants';
import lodash from "lodash";
import { Vault } from "../types/vault";
import { Tag, Tags } from "../types/contract";
import { NodeLike } from "../types/node";
import { Membership } from "../types/membership";
import { Object, ObjectType } from "../types/object";
import { EncryptedPayload } from "@akord/crypto/lib/types";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";

declare const Buffer;

export const STATE_CONTENT_TYPE = "application/json";

class Service {
  api: Api
  wallet: Wallet

  dataEncrypter: Encrypter
  keys: Array<EncryptedKeys>

  vaultId: string
  objectId: string
  objectType: ObjectType
  function: functions
  isPublic: boolean
  vault: Vault
  object: Object
  actionRef: string
  groupRef: string
  tags: Tags

  constructor(wallet: Wallet, api: Api, encryptionKeys?: EncryptionKeys) {
    this.wallet = wallet
    this.api = api
    // for the data encryption
    this.dataEncrypter = new Encrypter(
      wallet,
      encryptionKeys?.keys,
      encryptionKeys?.getPublicKey()
    )
  }

  setKeys(keys: EncryptedKeys[]) {
    this.keys = keys;
    this.dataEncrypter.setKeys(keys);
  }

  setVaultId(vaultId: string) {
    this.vaultId = vaultId;
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

  setRawDataEncryptionPublicKey(publicKey) {
    this.dataEncrypter.setRawPublicKey(publicKey);
  }

  async processReadRaw(data: any, headers: any, shouldDecrypt = true) {
    if (this.isPublic || !shouldDecrypt) {
      return Buffer.from(data.data);
    }

    const encryptedPayload = this.getEncryptedPayload(data, headers);
    try {
      if (encryptedPayload) {
        return this.dataEncrypter.decryptRaw(encryptedPayload, false);
      } else {
        return this.dataEncrypter.decryptRaw(data);
      }
    } catch (error) {
      throw new IncorrectEncryptionKey(error);
    }
  }

  protected async setVaultContext(vaultId: string) {
    const vault = await this.api.getVault(vaultId);
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    await this.setMembershipKeys(vaultId);
  }

  protected async setMembershipKeys(vaultId: string) {
    if (!this.isPublic) {
      const encryptionKeys = await this.api.getMembershipKeys(vaultId);
      const keys = encryptionKeys.keys.map(((keyPair: any) => {
        return {
          encPrivateKey: keyPair.encPrivateKey,
          encPublicKey: keyPair.publicKey ? keyPair.publicKey : keyPair.encPublicKey
        }
      }))
      this.setKeys(keys);
      try {
        if (encryptionKeys.publicKey) {
          this.setRawDataEncryptionPublicKey(base64ToArray(encryptionKeys.publicKey));
        } else {
          const publicKey = await this.dataEncrypter.wallet.decrypt(encryptionKeys.keys[encryptionKeys.keys.length - 1].encPublicKey);
          this.setRawDataEncryptionPublicKey(publicKey);
        }
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
  }

  protected setObjectId(objectId: string) {
    this.objectId = objectId;
  }

  protected setObjectType(objectType: ObjectType) {
    this.objectType = objectType;
  }

  protected setFunction(functionName: functions) {
    this.function = functionName;
  }

  protected setActionRef(actionRef: string) {
    this.actionRef = actionRef;
  }

  protected setObject(object: NodeLike | Membership | Vault) {
    this.object = object;
  }

  protected async getProfileDetails() {
    const user = await this.api.getUser();
    if (user) {
      const profileEncrypter = new Encrypter(this.wallet, null, null);
      profileEncrypter.decryptedKeys = [
        {
          publicKey: this.wallet.publicKeyRaw(),
          privateKey: this.wallet.privateKeyRaw()
        }
      ]
      let avatar = null;
      const resourceUri = this.getAvatarUri(user);
      if (resourceUri) {
        const { fileData, headers } = await this.api.downloadFile(resourceUri);
        const encryptedPayload = this.getEncryptedPayload(fileData, headers);
        try {
          if (encryptedPayload) {
            avatar = await profileEncrypter.decryptRaw(encryptedPayload, false);
          } else {
            const dataString = arrayToString(new Uint8Array(fileData.data));
            avatar = await profileEncrypter.decryptRaw(dataString, true);
          }
        } catch (error) {
          throw new IncorrectEncryptionKey(error);
        }
      }
      try {
        const decryptedProfile = await profileEncrypter.decryptObject(
          user,
          ['name'],
        );
        return { ...decryptedProfile, avatar }
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
    return {};
  }

  protected async processWriteRaw(data: any, encryptedKey?: string) {
    let processedData: any;
    const tags = [] as Tags;
    if (this.isPublic) {
      processedData = data;
    } else {
      let encryptedFile: EncryptedPayload;
      try {
        encryptedFile = await this.dataEncrypter.encryptRaw(data, false, encryptedKey) as EncryptedPayload;
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
      processedData = encryptedFile.encryptedData.ciphertext;
      const { address } = await this.getActiveKey();
      tags.push(new Tag(encryptionTags.IV, encryptedFile.encryptedData.iv))
      tags.push(new Tag(encryptionTags.ENCRYPTED_KEY, encryptedFile.encryptedKey))
      tags.push(new Tag(encryptionTags.PUBLIC_ADDRESS, address))
    }
    return { processedData, encryptionTags: tags }
  }

  protected async getActiveKey() {
    return {
      address: await deriveAddress(this.dataEncrypter.publicKey),
      publicKey: arrayToBase64(this.dataEncrypter.publicKey)
    };
  }

  protected async processWriteString(data: string) {
    if (this.isPublic) return data;
    let encryptedPayload: string;
    try {
      encryptedPayload = await this.dataEncrypter.encryptRaw(stringToArray(data)) as string;
    } catch (error) {
      throw new IncorrectEncryptionKey(error);
    }
    const decodedPayload = base64ToJson(encryptedPayload) as any;
    decodedPayload.publicAddress = (await this.getActiveKey()).address;
    delete decodedPayload.publicKey;
    return jsonToBase64(decodedPayload);
  }

  protected getAvatarUri(profileDetails: any) {
    if (profileDetails.avatarUri && profileDetails.avatarUri.length) {
      return [...profileDetails.avatarUri].reverse().find(resourceUri => resourceUri.startsWith("s3:"))?.replace("s3:", "");
    }
    else if (profileDetails.avatarUrl) {
      return profileDetails.avatarUrl;
    }
    return null;
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

  protected getEncryptedPayload(data: any, headers: any): EncryptedPayload {
    const encryptedKey = headers['x-amz-meta-encryptedkey'];
    const iv = headers['x-amz-meta-iv'];
    if (encryptedKey && iv) {
      return {
        encryptedKey,
        encryptedData: {
          iv: base64ToArray(iv),
          ciphertext: data
        }
      }
    }
    return null;
  }

  protected async mergeAndUploadBody(body: any): Promise<string> {
    const currentState = this.object?.data?.length > 0
      ? await this.api.getNodeState(this.object.data[this.object.data.length - 1])
      : {};
    const mergedBody = await this.mergeState(currentState, body);
    return this.uploadState(mergedBody);
  }

  protected async signData(data: any): Promise<string> {
    const encodedBody = jsonToBase64(data)
    const privateKeyRaw = this.wallet.signingPrivateKeyRaw()
    const signature = await signString(
      encodedBody,
      privateKeyRaw
    )
    return signature;
  }

  protected async uploadState(state: any): Promise<string> {
    const signature = await this.signData(state);
    const tags = [
      new Tag(dataTags.DATA_TYPE, "State"),
      new Tag(smartweaveTags.CONTENT_TYPE, STATE_CONTENT_TYPE),
      new Tag(protocolTags.SIGNATURE, signature),
      new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()),
      new Tag(protocolTags.VAULT_ID, this.vaultId),
      new Tag(protocolTags.NODE_TYPE, this.objectType),
    ]
    if (this.objectType === objectType.MEMBERSHIP) {
      tags.push(new Tag(protocolTags.MEMBERSHIP_ID, this.objectId))
    } else if (this.objectType !== objectType.VAULT) {
      tags.push(new Tag(protocolTags.NODE_ID, this.objectId))
    }
    const ids = await this.api.uploadData([{ data: state, tags }], true);
    return ids[0];
  }

  protected async mergeState(currentState: any, stateUpdates: any) {
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

  protected async getUserEncryptionInfo(email: string) {
    const { address, publicKey } = await this.api.getUserPublicData(email);
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
    return tags;
  }
}

export {
  Service
}