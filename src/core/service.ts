import { Api } from "../api/api";
import {
  Wallet,
  EncrypterFactory,
  EncryptionKeys,
  signString,
  jsonToBase64,
  base64ToArray,
  arrayToString,
  stringToArray,
  arrayToBase64,
  base64ToJson,
  deriveAddress,
  KeysStructureEncrypter,
} from "@akord/crypto";
import { v4 as uuidv4 } from "uuid";
import { objectType, protocolTags, functions, dataTags, encryptionTags } from '../constants';
import lodash from "lodash";
import { Vault } from "../types/vault";
import { Tag, Tags } from "../types/contract";
import { NodeLike } from "../types/node";
import { Membership, MembershipKeys } from "../types/membership";
import { Object, ObjectType } from "../types/object";
import { EncryptedPayload } from "@akord/crypto/dist/types";

declare const Buffer;

class Service {
  api: Api
  wallet: Wallet

  dataEncrypter: KeysStructureEncrypter
  membershipKeys: MembershipKeys

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
    this.dataEncrypter = new KeysStructureEncrypter(
      wallet,
      encryptionKeys?.keys,
      null
    )
  }

  protected async setVaultContext(vaultId: string) {
    const vault = await this.api.getObject<Vault>(vaultId, objectType.VAULT, vaultId);
    this.setVault(vault);
    this.setVaultId(vaultId);
    this.setIsPublic(vault.public);
    await this.setMembershipKeys(vaultId);
  }


  protected async setVaultContextFromObjectId(objectId: string, objectType: ObjectType, vaultId?: string) {
    const object = await this.api.getObject<Object>(objectId, objectType, this.vaultId);
    await this.setVaultContext(vaultId || object.vaultId);
    this.setObject(object);
    this.setObjectId(objectId);
    this.setObjectType(objectType);
  }

  protected async setMembershipKeys(vaultId: string) {
    if (!this.isPublic) {
      const encryptionKeys = await this.api.getMembershipKeys(vaultId);
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

  protected async nodeUpdate(body?: any, clientInput?: any): Promise<{ transactionId: string, object: NodeLike }> {
    const input = {
      function: this.function,
      ...clientInput
    };

    this.tags = await this.getTags();

    if (body) {
      const id = await this.mergeAndUploadBody(body);
      input.data = id;
    }
    const { id, object }= await this.api.postContractTransaction<NodeLike>(
      this.vaultId,
      input,
      this.tags
    );
    return { transactionId: id, object }
  }

  protected async nodeCreate<T>(body?: any, clientInput?: any): Promise<{
    nodeId: string,
    transactionId: string,
    object: T
  }> {
    const nodeId = uuidv4();
    this.setObjectId(nodeId);
    this.setFunction(functions.NODE_CREATE);

    this.tags = await this.getTags();

    const input = {
      function: this.function,
      ...clientInput
    };

    if (body) {
      const id = await this.uploadState(body);
      input.data = id;
    }

    const { id, object } = await this.api.postContractTransaction<T>(
      this.vaultId,
      input,
      this.tags
    );
    this.setActionRef(null);
    return { nodeId, transactionId: id, object };
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

  protected setObjectType(objectType: ObjectType) {
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
    const profile = await this.api.getProfile();
    if (profile) {
      const profileKeys = new EncryptionKeys(
        profile.state.encryptionType,
        profile.state.keys,
        profile.state.encAccessKey,
        null
      );
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
      const resourceUri = this.getAvatarUri(profileDetails);
      if (resourceUri) {
        const { fileData, headers } = await this.api.downloadFile(resourceUri);
        const encryptedPayload = this.getEncryptedPayload(fileData, headers);
        if (encryptedPayload) {
          avatar = await profileEncrypter.decryptRaw(encryptedPayload, false);
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
      const encryptedFile = await this.dataEncrypter.encryptRaw(data, false, encryptedKey) as EncryptedPayload;
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
      address: await deriveAddress(this.dataEncrypter.publicKey, "akord"),
      publicKey: arrayToBase64(this.dataEncrypter.publicKey as Uint8Array)
    };
  }

  protected async processWriteString(data: string) {
    if (this.isPublic) return data;
    const encryptedPayload = await this.dataEncrypter.encryptRaw(stringToArray(data)) as string;
    const decodedPayload = base64ToJson(encryptedPayload);
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

  async processReadRaw(data: any, headers: any, shouldDecrypt = true) {
    if (this.isPublic || !shouldDecrypt) {
      return Buffer.from(data.data);
    }

    const encryptedPayload = this.getEncryptedPayload(data, headers);
    if (encryptedPayload) {
      return this.dataEncrypter.decryptRaw(encryptedPayload, false);
    } else {
      return this.dataEncrypter.decryptRaw(data);
    }
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
    const mergedBody = await this.mergeState(body);
    return this.uploadState(mergedBody);
  }

  protected async signData(data: any): Promise<string> {
    const encodedBody = jsonToBase64(data)
    const privateKeyRaw = await this.wallet.signingPrivateKeyRaw()
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
    if (this.objectType === objectType.MEMBERSHIP) {
      tags.push(new Tag(protocolTags.MEMBERSHIP_ID, this.objectId));
    } else if (this.objectType !== objectType.VAULT) {
      tags.push(new Tag(protocolTags.NODE_ID, this.objectId));
    }
    return tags;
  }
}

export {
  Service
}