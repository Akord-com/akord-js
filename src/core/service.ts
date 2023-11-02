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
import { objectType, protocolTags, functions, dataTags, encryptionTags, smartweaveTags, AKORD_TAG } from '../constants';
import { Vault } from "../types/vault";
import { Tag, Tags } from "../types/contract";
import { NodeLike } from "../types/node";
import { Membership } from "../types/membership";
import { Object, ObjectType } from "../types/object";
import { EncryptedPayload } from "@akord/crypto/lib/types";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";
import { getEncryptedPayload, mergeState } from "./common";
import { EncryptionMetadata } from "../types/encryption";

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

  tags: string[] // akord tags for easier search
  arweaveTags: Tags // arweave tx tags

  constructor(wallet: Wallet, api: Api, service?: Service, encryptionKeys?: EncryptionKeys) {
    this.wallet = wallet
    this.api = api
    // for the data encryption
    this.dataEncrypter = new Encrypter(
      wallet,
      encryptionKeys?.keys,
      encryptionKeys?.getPublicKey()
    )
    // set context from another service
    if (service) {
      this.setVault(service.vault);
      this.setVaultId(service.vaultId);
      this.setIsPublic(service.isPublic);
      this.setKeys(service.keys);
      this.setRawDataEncryptionPublicKey(service.dataEncrypter.publicKey);
      this.setFunction(service.function);
      this.setActionRef(service.actionRef);
      this.setObjectId(service.objectId);
      this.setObject(service.object);
      this.setGroupRef(service.groupRef);
      this.setAkordTags(service.tags);
    }
  }

  setKeys(keys: EncryptedKeys[]) {
    this.keys = keys;
    this.dataEncrypter.setKeys(keys);
  }

  setVaultId(vaultId: string) {
    this.vaultId = vaultId;
  }

  setObjectId(objectId: string) {
    this.objectId = objectId;
  }

  setGroupRef(groupRef: string) {
    this.groupRef = groupRef;
  }

  setActionRef(actionRef: string) {
    this.actionRef = actionRef;
  }

  setObjectType(objectType: ObjectType) {
    this.objectType = objectType;
  }

  setFunction(functionName: functions) {
    this.function = functionName;
  }

  setObject(object: NodeLike | Membership | Vault) {
    this.object = object;
  }

  setIsPublic(isPublic: boolean) {
    this.isPublic = isPublic;
  }

  setVault(vault: Vault) {
    this.vault = vault;
  }

  setRawDataEncryptionPublicKey(publicKey: Uint8Array) {
    this.dataEncrypter.setRawPublicKey(publicKey);
  }

  setAkordTags(tags: string[]) {
    this.tags = tags;
  }

  async processWriteString(data: string): Promise<string> {
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

  async setVaultContext(vaultId: string) {
    const vault = await this.api.getVault(vaultId);
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    await this.setMembershipKeys(vault);
  }

  async setMembershipKeys(object: Object) {
    if (!this.isPublic) {
      const keys = object.__keys__.map(((keyPair: any) => {
        return {
          encPrivateKey: keyPair.encPrivateKey,
          encPublicKey: keyPair.publicKey ? keyPair.publicKey : keyPair.encPublicKey
        }
      }))
      this.setKeys(keys);
      try {
        if (object.__publicKey__) {
          this.setRawDataEncryptionPublicKey(base64ToArray(object.__publicKey__));
        } else {
          const currentEncPublicKey = object.__keys__[object.__keys__.length - 1].encPublicKey;
          const publicKey = await this.dataEncrypter.wallet.decrypt(currentEncPublicKey);
          this.setRawDataEncryptionPublicKey(publicKey);
        }
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
  }

  async uploadState(state: any, cacheOnly = true): Promise<string> {
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
    const ids = await this.api.uploadData([{ data: state, tags }], cacheOnly);
    return ids[0];
  }

  async getTxTags(): Promise<Tags> {
    const tags = [
      new Tag(protocolTags.FUNCTION_NAME, this.function),
      new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()),
      new Tag(protocolTags.VAULT_ID, this.vaultId),
      new Tag(protocolTags.TIMESTAMP, JSON.stringify(Date.now())),
      new Tag(protocolTags.NODE_TYPE, this.objectType),
      new Tag(protocolTags.PUBLIC, this.isPublic ? "true" : "false"),
    ]
    if (this.groupRef) {
      tags.push(new Tag(protocolTags.GROUP_REF, this.groupRef));
    }
    if (this.actionRef) {
      tags.push(new Tag(protocolTags.ACTION_REF, this.actionRef));
    }
    this.tags
      ?.filter(tag => tag)
      ?.map((tag: string) =>
        tag?.split(" ").join(",").split(".").join(",").split(",").map((value: string) =>
          tags.push(new Tag(AKORD_TAG, value.toLowerCase())))
      );
    // remove duplicates
    return [...new Map(tags.map(item => [item.value, item])).values()];
  }

  protected async processWriteRaw(data: ArrayBuffer, encryptedKey?: string) {
    let processedData: ArrayBuffer;
    const tags = [] as Tags;
    if (this.isPublic) {
      processedData = data;
    } else {
      let encryptedFile: EncryptedPayload;
      try {
        encryptedFile = await this.dataEncrypter.encryptRaw(new Uint8Array(data), { prefixCiphertextWithIv: true, encode: false, encryptedKey: encryptedKey }) as EncryptedPayload;
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
      processedData = encryptedFile.encryptedData.ciphertext as ArrayBuffer;
      const { address } = await this.getActiveKey();
      tags.push(new Tag(encryptionTags.ENCRYPTED_KEY, encryptedFile.encryptedKey))
      tags.push(new Tag(encryptionTags.PUBLIC_ADDRESS, address))
    }
    return { processedData, encryptionTags: tags }
  }

  protected async processReadRaw(data: ArrayBuffer | string, metadata: EncryptionMetadata, shouldDecrypt = true): Promise<ArrayBuffer> {
    if (this.isPublic || !shouldDecrypt) {
      return data as ArrayBuffer;
    }

    const encryptedPayload = getEncryptedPayload(data, metadata);
    try {
      if (encryptedPayload) {
        return this.dataEncrypter.decryptRaw(encryptedPayload, false);
      } else {
        return this.dataEncrypter.decryptRaw(data as string);
      }
    } catch (error) {
      throw new IncorrectEncryptionKey(error);
    }
  }

  protected async processReadString(data: string, shouldDecrypt = true): Promise<string> {
    if (this.isPublic || !shouldDecrypt) return data;
    const decryptedDataRaw = await this.processReadRaw(data, {});
    return arrayToString(decryptedDataRaw);
  }

  protected async getActiveKey() {
    return {
      address: await deriveAddress(this.dataEncrypter.publicKey),
      publicKey: arrayToBase64(this.dataEncrypter.publicKey)
    };
  }

  protected async getCurrentState(): Promise<any> {
    return this.object?.data?.length > 0
      ? await this.api.getNodeState(this.object.data[this.object.data.length - 1])
      : {};
  }

  protected async mergeAndUploadState(stateUpdates: any, cacheOnly = true): Promise<string> {
    const currentState = await this.getCurrentState();
    const mergedState = mergeState(currentState, stateUpdates);
    return this.uploadState(mergedState, cacheOnly);
  }

  private async signData(data: any): Promise<string> {
    const privateKeyRaw = this.wallet.signingPrivateKeyRaw();
    const signature = await signString(
      jsonToBase64(data),
      privateKeyRaw
    );
    return signature;
  }
}

export { Service };