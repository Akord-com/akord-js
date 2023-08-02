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
  EncryptedKeys,
  generateKeyPair,
  Keys
} from "@akord/crypto";
import { objectType, protocolTags, functions, dataTags, encryptionTags, smartweaveTags, AKORD_TAG } from '../constants';
import lodash from "lodash";
import { Vault } from "../types/vault";
import { Tag, Tags } from "../types/contract";
import { NodeLike } from "../types/node";
import { Membership } from "../types/membership";
import { Object, ObjectType } from "../types/object";
import { EncryptedPayload } from "@akord/crypto/lib/types";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";
import { ProfileDetails } from "../types/profile-details";
import { ListOptions } from "../types/query-options";

export type EncryptionMetadata = {
  encryptedKey?: string,
  iv?: string
}

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

  setObjectId(objectId: string) {
    this.objectId = objectId;
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

  setRawDataEncryptionPublicKey(publicKey: Uint8Array) {
    this.dataEncrypter.setRawPublicKey(publicKey);
  }

  setAkordTags(tags: string[]) {
    this.tags = tags;
  }

  async processReadRaw(data: ArrayBuffer | string, metadata: EncryptionMetadata, shouldDecrypt = true): Promise<ArrayBuffer> {
    if (this.isPublic || !shouldDecrypt) {
      return data as ArrayBuffer;
    }

    const encryptedPayload = this.getEncryptedPayload(data, metadata);
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

  protected async setVaultContext(vaultId: string) {
    const vault = await this.api.getVault(vaultId);
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    await this.setMembershipKeys(vault);
  }

  protected async setMembershipKeys(object: Object) {
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

  protected async getProfileDetails(): Promise<ProfileDetails> {
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
      const resourceUri = this.getAvatarUri(new ProfileDetails(user));
      if (resourceUri) {
        const { fileData, metadata } = await this.api.downloadFile(resourceUri);
        const encryptedPayload = this.getEncryptedPayload(fileData, metadata);
        try {
          if (encryptedPayload) {
            avatar = await profileEncrypter.decryptRaw(encryptedPayload, false);
          } else {
            const dataString = arrayToString(new Uint8Array(fileData));
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
    return <any>{};
  }

  protected async processWriteRaw(data: ArrayBuffer, encryptedKey?: string) {
    let processedData: ArrayBuffer;
    const tags = [] as Tags;
    if (this.isPublic) {
      processedData = data;
    } else {
      let encryptedFile: EncryptedPayload;
      try {
        encryptedFile = await this.dataEncrypter.encryptRaw(new Uint8Array(data), false, encryptedKey) as EncryptedPayload;
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

  protected async processWriteString(data: string): Promise<string> {
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

  protected getAvatarUri(profileDetails: ProfileDetails) {
    if (profileDetails.avatarUri && profileDetails.avatarUri.length) {
      const avatarUri = [...profileDetails.avatarUri].reverse().find(resourceUri => resourceUri.startsWith("s3:"))?.replace("s3:", "");
      return avatarUri !== "null" && avatarUri;
    } else {
      return null;
    }
  }

  protected async processAvatar(avatar: ArrayBuffer, cacheOnly?: boolean): Promise<{ resourceTx: string, resourceUrl: string }> {
    const { processedData, encryptionTags } = await this.processWriteRaw(avatar);
    return this.api.uploadFile(processedData, encryptionTags, { cacheOnly, public: false });
  }

  protected async processMemberDetails(memberDetails: { name?: string, avatar?: ArrayBuffer }, cacheOnly?: boolean) {
    const processedMemberDetails = {} as ProfileDetails;
    if (!this.isPublic) {
      if (memberDetails.name) {
        processedMemberDetails.name = await this.processWriteString(memberDetails.name);
      }
      if (memberDetails.avatar) {
        const { resourceUrl, resourceTx } = await this.processAvatar(memberDetails.avatar, cacheOnly);
        processedMemberDetails.avatarUri = [`arweave:${resourceTx}`, `s3:${resourceUrl}`];
      }
    }
    return new ProfileDetails(processedMemberDetails);
  }

  protected async processReadString(data: string, shouldDecrypt = true): Promise<string> {
    if (this.isPublic || !shouldDecrypt) return data;
    const decryptedDataRaw = await this.processReadRaw(data, {});
    return arrayToString(decryptedDataRaw);
  }

  protected getEncryptedPayload(data: ArrayBuffer | string, metadata: EncryptionMetadata): EncryptedPayload {
    const { encryptedKey, iv } = metadata;
    if (encryptedKey && iv) {
      return {
        encryptedKey,
        encryptedData: {
          iv: base64ToArray(iv),
          ciphertext: data as ArrayBuffer
        }
      }
    }
    return null;
  }

  protected async getCurrentState(): Promise<any> {
    return this.object?.data?.length > 0
      ? await this.api.getNodeState(this.object.data[this.object.data.length - 1])
      : {};
  }

  protected async mergeAndUploadState(stateUpdates: any): Promise<string> {
    const currentState = await this.getCurrentState();
    const mergedState = await this.mergeState(currentState, stateUpdates);
    return this.uploadState(mergedState);
  }

  protected async signData(data: any): Promise<string> {
    const privateKeyRaw = this.wallet.signingPrivateKeyRaw();
    const signature = await signString(
      jsonToBase64(data),
      privateKeyRaw
    );
    return signature;
  }

  public async uploadState(state: any, cacheOnly = false): Promise<string> {
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
    const ids = await this.api.uploadData([{ data: state, tags }], { cacheOnly });
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

  protected async getTxTags(): Promise<Tags> {
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

  protected async handleListErrors<T>(originalItems: Array<T>, promises: Array<Promise<T>>)
    : Promise<{ items: Array<T>, errors: Array<{ id: string, error: Error }> }> {
    const results = await Promise.all(promises.map(p => p.catch(e => e)));
    const items = results.filter(result => !(result instanceof Error));
    const errors = results
      .map((result, index) => ({ result, index }))
      .filter((mapped) => mapped.result instanceof Error)
      .map((filtered) => ({ id: (<any>originalItems[filtered.index]).id, error: filtered.result }));
    return { items, errors };
  }

  protected async paginate<T>(apiCall: any, listOptions: ListOptions & { vaultId?: string }): Promise<Array<T>> {
    let token = undefined;
    let results = [] as T[];
    do {
      const { items, nextToken } = await apiCall(listOptions);
      results = results.concat(items);
      token = nextToken;
      listOptions.nextToken = nextToken;
      if (nextToken === "null") {
        token = undefined;
      }
    } while (token);
    return results;
  }

  protected async rotateMemberKeys(publicKeys: Map<string, string>): Promise<{
    memberKeys: Map<string, EncryptedKeys[]>,
    keyPair: Keys
  }> {
    const memberKeys = new Map<string, EncryptedKeys[]>();
    // generate a new vault key pair
    const keyPair = await generateKeyPair();

    for (let [memberId, publicKey] of publicKeys) {
      const memberKeysEncrypter = new Encrypter(
        this.wallet,
        this.dataEncrypter.keys,
        base64ToArray(publicKey)
      );
      try {
        memberKeys.set(memberId, [await memberKeysEncrypter.encryptMemberKey(keyPair)]);
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
    return { memberKeys, keyPair };
  }
}

export {
  Service
}