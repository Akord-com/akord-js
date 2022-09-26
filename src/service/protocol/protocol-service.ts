import { Service } from '../service'
import { generateKeyPair, jsonToBase64, base64ToArray, arrayToBase64 } from "@akord/crypto";
import { ArweaveWallet } from "@akord/crypto";
import { KeysStructureEncrypter } from "@akord/crypto";
import { protocolTags, commands } from "./protocol-constants";
import { v4 as uuidv4 } from "uuid";
import lodash from "lodash";
import { reactionEmoji, status, objectTypes } from '../../constants'

class ProtocolService extends Service {

  dataEncrypter: KeysStructureEncrypter
  keysEncrypter: KeysStructureEncrypter

  async vaultArchive() {
    this.setCommand(commands.VAULT_ARCHIVE);
    return this.nodeUpdate();
  }

  async membershipReject() {
    this.setCommand(commands.MEMBERSHIP_REJECT);
    return this.nodeUpdate();
  }

  async membershipChangeRole(role: string) {
    this.setCommand(commands.MEMBERSHIP_CHANGE_ROLE);
    return this.nodeUpdate(null, { role });
  }

  async nodeRevoke() {
    this.setCommand(commands.NODE_REVOKE);
    return this.nodeUpdate();
  }

  async nodeRestore() {
    this.setCommand(this.objectType === "Vault" ? commands.VAULT_RESTORE : commands.NODE_RESTORE);
    return this.nodeUpdate();
  }

  async nodeDelete() {
    this.setCommand(commands.NODE_DELETE);
    return this.nodeUpdate();
  }

  async nodeMove(parent?: string) {
    this.setCommand(commands.NODE_MOVE);
    return this.nodeUpdate(null, { parent });
  }

  async memoAddReaction(reaction: reactionEmoji, author: string): Promise<{ transactionId: string }> {
    const body = {
      reactions: [{
        reaction: await this.processWriteString(reaction),
        name: await this.processWriteString(author),
        address: await this.wallet.getAddress(),
        status: "ACTIVE",
        postedAt: new Date()
      }]
    };
    this.setCommand(commands.NODE_UPDATE);
    return this.nodeUpdate(body);
  }

  async memoRemoveReaction(reaction: reactionEmoji): Promise<{ transactionId: string }> {
    this.setCommand(commands.NODE_UPDATE);
    this.tags = await this.getTags();

    const body = await this._removeReaction(reaction);
    const { data, metadata } = await this._uploadBody(body);

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      { function: this.command, data },
      this.tags,
      { ...metadata, ...this.metadata() }
    );
    return { transactionId: txId }
  }

  async noteUploadRevision(name: string, content: string): Promise<{ transactionId: string }> {
    const body = {
      revisions: [{
        title: await this.processWriteString(name),
        content: await this.processWriteString(content),
        size: Buffer.byteLength(content, 'utf8'),
        postedAt: new Date()
      }]
    };
    this.setCommand(commands.NODE_UPDATE);
    return this.nodeUpdate(body);
  }

  async noteCreate(name: string, content: string, parentId?: string): Promise<{
    noteId: string,
    transactionId: string
  }> {
    const body = {
      revisions: [{
        title: await this.processWriteString(name),
        content: await this.processWriteString(content),
        size: Buffer.byteLength(content, 'utf8'),
        postedAt: new Date()
      }]
    };
    this.setObjectType(objectTypes.NOTE);
    const { nodeId, transactionId } = await this.nodeCreate(body, {
      parent: parentId
    });
    return { noteId: nodeId, transactionId };
  }


  async nodeRename(name: string): Promise<{ transactionId: string }> {
    const body = {
      name: await this.processWriteString(name)
    };
    this.setCommand(this.objectType === "Vault" ? commands.VAULT_UPDATE : commands.NODE_UPDATE);
    return this.nodeUpdate(body);
  }

  async nodeUpdate(body?: any, clientInput?: any, clientMetadata?: any): Promise<{ transactionId: string }> {
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

  async nodeCreate(body?: any, clientInput?: any, clientMetadata?: any): Promise<{
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

  async stackCreate(name: string, file: any, parentId?: string, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{
    stackId: string,
    transactionId: string
  }> {
    const { resourceTx, resourceUrl, thumbnailTx, thumbnailUrl } = await this._postFile(file, progressHook, cancelHook);

    const body = {
      name: await this.processWriteString(name ? name : file.name),
      files: [
        {
          postedAt: JSON.stringify(Date.now()),
          name: await this.processWriteString(file.name ? file.name : name),
          type: file.type,
          size: file.size,
          resourceTx: resourceTx,
          thumbnailTx: thumbnailTx
        }
      ]
    };
    this.setObjectType(objectTypes.STACK);
    const { nodeId, transactionId } = await this.nodeCreate(body, {
      parent: parentId
    }, { resourceUrl, thumbnailUrl });
    return { stackId: nodeId, transactionId };
  }

  async stackUploadRevision(file: any, progressHook?: (progress: number) => void): Promise<{ transactionId: string }> {
    const { resourceTx, resourceUrl, thumbnailTx, thumbnailUrl } = await this._postFile(file, progressHook);

    const body = {
      files: [
        {
          postedAt: JSON.stringify(Date.now()),
          name: await this.processWriteString(file.name),
          type: file.type,
          size: file.size,
          resourceTx: resourceTx,
          thumbnailTx: thumbnailTx
        }
      ]
    };
    this.setCommand(commands.NODE_UPDATE);
    return this.nodeUpdate(body, null, { resourceUrl, thumbnailUrl });
  }

  async folderCreate(name: string, parentId?: string): Promise<{
    folderId: string,
    transactionId: string
  }> {
    const body = {
      name: await this.processWriteString(name)
    }
    this.setObjectType(objectTypes.FOLDER);
    const { nodeId, transactionId } = await this.nodeCreate(body, {
      parent: parentId
    });
    return { folderId: nodeId, transactionId };
  }

  async memoCreate(message: string): Promise<{
    memoId: string,
    transactionId: string
  }> {
    const body = {
      message: await this.processWriteString(message)
    };
    this.setObjectType(objectTypes.MEMO);
    const { nodeId, transactionId } = await this.nodeCreate(body);
    return { memoId: nodeId, transactionId };
  }

  async membershipAccept(memberDetails: any): Promise<{ transactionId: string }> {
    const body = {
      memberDetails: await this.processMemberDetails(memberDetails, true),
      encPublicSigningKey: [await this.processWriteString(await this.wallet.signingPublicKey())]
    }
    this.setCommand(commands.MEMBERSHIP_ACCEPT);
    return this.nodeUpdate(body);
  }

  async membershipProfileUpdate(name: string, avatar: any): Promise<{ transactionId: string; }> {
    if (!name && !avatar) {
      throw new Error("Nothing to update.");
    }

    const memberDetails = await this.processMemberDetails({ fullName: name, avatar }, true);

    this.setCommand(commands.MEMBERSHIP_UPDATE);
    return this.nodeUpdate({ memberDetails });
  }

  async membershipInvite(email: string, role: string): Promise<{ membershipId: string; transactionId: string; }> {
    this.setCommand(commands.MEMBERSHIP_INVITE);
    this.setObjectType(objectTypes.MEMBERSHIP);
    const membershipId = uuidv4();
    this.setObjectId(membershipId);

    const { address, publicKey } = await this.getUserEncryptionInfo(email);
    this.setRawKeysEncryptionPublicKey(publicKey);
    const keys = await this.keysEncrypter.encryptMemberKeys([]);
    const body = {
      keys: keys.map((keyPair) => {
        delete keyPair.publicKey;
        return keyPair;
      })
    }

    this.tags = { [protocolTags.MEMBER_ADDRESS]: address, ...await this.getTags() }

    const { data, metadata } = await this._uploadBody(body);

    let input = {
      function: this.command,
      address,
      role,
      data
    }

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      input,
      this.tags,
      { ...metadata, ...this.metadata() }
    );
    return { membershipId, transactionId: txId };
  }

  async membershipConfirm(): Promise<{ transactionId: string; }> {
    this.setCommand(commands.MEMBERSHIP_INVITE);
    const { address, publicKey } = await this.getUserEncryptionInfo(this.object.email);
    this.setRawKeysEncryptionPublicKey(publicKey);
    const keys = await this.keysEncrypter.encryptMemberKeys([]);
    const body = {
      keys: keys.map((keyPair) => {
        delete keyPair.publicKey;
        return keyPair;
      })
    };
    this.tags = { [protocolTags.MEMBER_ADDRESS]: address, ...await this.getTags() }

    const { data, metadata } = await this._uploadBody(body);

    let input = {
      function: this.command,
      address,
      data,
      role: this.object.state.role
    }

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      input,
      this.tags,
      { ...metadata, isUpdate: true, ...this.metadata() }
    );
    return { transactionId: txId };
  }

  async membershipRevoke() {
    this.setCommand(commands.MEMBERSHIP_REVOKE);

    let data: any, metadata: any;
    if (!this.isPublic) {
      // generate a new vault key pair
      const keyPair = await generateKeyPair();

      const memberships = await this.api.getObjectsByVaultId(this.vaultId, "Membership");

      this.tags = await this.getTags();

      let newMembershipStates = [];
      let newMembershipRefs = [];
      for (let member of memberships) {
        if (member.id !== this.objectId
          && (member.status === status.ACCEPTED || member.status === status.PENDING)) {
          const { publicKey } = await this.getUserEncryptionInfo(member.email, member.address);
          const memberKeysEncrypter = new KeysStructureEncrypter(
            this.wallet,
            this.keysEncrypter.keys,
            publicKey
          );
          const keys = [await memberKeysEncrypter.encryptMemberKey(keyPair)];
          const newState = await this.mergeState(member.id, "Membership", { keys });
          const signature = await this.signData(newState);
          newMembershipStates.push({
            body: newState, tags: {
              "Data-Type": "State",
              [protocolTags.SIGNATURE]: signature,
              [protocolTags.SIGNER_ADDRESS]: this.tags[protocolTags.SIGNER_ADDRESS],
              [protocolTags.VAULT_ID]: this.tags[protocolTags.VAULT_ID],
              [protocolTags.NODE_TYPE]: objectTypes.MEMBERSHIP,
              [protocolTags.MEMBERSHIP_ID]: member.id,
            }
          });
          newMembershipRefs.push(member.id);
        }
      }
      const ids = await this.api.uploadData(newMembershipStates, true);
      data = [];
      metadata = {
        dataRefs: [],
        publicKeys: [arrayToBase64(keyPair.publicKey)],
      }

      newMembershipRefs.forEach((memberId, memberIndex) => {
        metadata.dataRefs.push({ ...ids[memberIndex], modelId: memberId, modelType: "Membership" });
        data.push({ id: memberId, value: ids[memberIndex].id })
      })
    }

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      { function: this.command, data },
      this.tags,
      { ...metadata, ...this.metadata() }
    );
    return { transactionId: txId };
  }

  async vaultCreate(name: string, termsOfAccess: string, memberDetails: any, isPublic?: boolean): Promise<{
    vaultId: string,
    membershipId: string,
    transactionId: string
  }> {
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
    this.setObjectType(objectTypes.VAULT);

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
        { ...ids[0], modelId: this.vaultId, modelType: objectTypes.VAULT },
        { ...ids[1], modelId: membershipId, modelType: objectTypes.MEMBERSHIP }
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

  async getTags() {
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

  metadata() {
    const metadata = {
      actionRef: this.actionRef,
      groupRef: this.groupRef
    };
    return metadata;
  }

  async _getReactionIndex(reactions: any[], reaction: string) {
    const address = await this.wallet.getAddress();
    for (const [key, value] of Object.entries(reactions)) {
      if ((<any>value).status === 'ACTIVE'
        && (<any>value).address === address
        && reaction === await this.processReadString((<any>value).reaction)) {
        return <any>(<unknown>key);
      }
    }
    return -1;
  }

  async _removeReaction(reaction: string) {
    const currentState = await this.api.getNodeState(this.objectId, this.objectType, this.vaultId);
    const index = await this._getReactionIndex(currentState.reactions, reaction);
    if (index < 0) {
      throw new Error("Could not find reaction: " + reaction + " for given user.")
    }
    const newState = lodash.cloneDeepWith(currentState);
    newState.reactions.splice(index, 1);
    return newState;
  }

  async getUserEncryptionInfo(email?: string, address?: string) {
    if (email) {
      const { address, publicKey } = await this.api.getUserFromEmail(email);
      return { address, publicKey: base64ToArray(publicKey) }
    } else {
      const publicKey = await (<ArweaveWallet>this.wallet).getPublicKeyFromAddress(address);
      return { address, publicKey }
    }
  }
}

export {
  ProtocolService
}