import { Service } from '../service'
import {
  arrayToBase64,
  generateKeyPair,
  jsonToBase64,
  signString,
  AkordWallet,
  KeysStructureEncrypter,
  EncryptionType
} from "@akord/crypto"
import { commands } from "./ledger-constants"
import { AkordApi } from '../../api'
import { reactionEmoji, actionRefs } from '../../constants'

const BATCH_TRANSACTION_LIMIT = 50;

class LedgerService extends Service {

  wallet: AkordWallet
  api: AkordApi

  _getObjectTypeUpperCase(): string {
    return this.objectType === "Vault" ? "DATAROOM" : this.objectType.toUpperCase();
  }

  _getObjectTypeLowerCase(): string {
    return this.objectType === "Vault" ? "dataroom" : this.objectType.toLowerCase();
  }

  async vaultArchive(): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: commands.VAULT_ARCHIVE,
      ...await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { status: "ARCHIVED" }
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async vaultDelete(): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: commands.VAULT_DELETE,
      ...await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { status: "DELETED" }
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async membershipReject(): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: commands.MEMBERSHIP_REJECT,
      ...await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { status: "REJECTED" }
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async membershipAccept(memberDetails: any) {
    const header = {
      schemaUri: commands.MEMBERSHIP_ACCEPT,
      ...await this.prepareHeader()
    }
    const body = {
      status: "ACCEPTED",
      memberDetails: await this.processMemberDetails(memberDetails),
    }

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async membershipProfileUpdate(name: string, avatar: any): Promise<{ transactionId: string; }> {
    if (!name && !avatar) {
      throw new Error("Nothing to update.");
    }

    const header = {
      schemaUri: commands.MEMBERSHIP_WRITE,
      ...await this.prepareHeader()
    }

    const memberDetails = await this.processMemberDetails({ fullName: name, avatar });

    const encodedTransaction = await this.encodeTransaction(header, { memberDetails });
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async membershipChangeRole(role: string): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: commands.MEMBERSHIP_WRITE,
      ...await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { role }
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async nodeMove(parentId?: string) {
    const header = {
      schemaUri: "akord:" + this._getObjectTypeLowerCase() + ":write",
      folderId: parentId,
      ...await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      {}
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async nodeRevoke(): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: "akord:" + this._getObjectTypeLowerCase() + ":revoke",
      ...await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { status: "REVOKED" }
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async nodeRename(name: string): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: "akord:" + this._getObjectTypeLowerCase() + ":write",
      ...await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { title: await this.processWriteString(name) }
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async folderCreate(name: string, parentId: string): Promise<{ folderId: string, transactionId: string }> {
    const header = {
      schemaUri: commands.FOLDER_WRITE,
      dataRoomId: this.vaultId,
      folderId: parentId,
      ...await this.prepareHeader()
    }
    const body = {
      status: "ACTIVE",
      title: await this.processWriteString(name)
    }

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { modelId, id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { folderId: modelId, transactionId: id };
  }

  async stackCreate(name: string, file: any, parentId: string, progressHook?: (progress: number) => void, cancelHook?: AbortController): Promise<{ stackId: string, transactionId: string }> {
    const header = {
      schemaUri: commands.STACK_WRITE,
      dataRoomId: this.vaultId,
      folderId: parentId,
      ...await this.prepareHeader()
    }

    const { resourceUrl, thumbnailUrl } = await this._postFile(file, progressHook, cancelHook);

    const body = {
      status: "ACTIVE",
      title: await this.processWriteString(name),
      files: [
        {
          postedAt: new Date(),
          title: await this.processWriteString(file.name),
          resourceUrl: resourceUrl,
          thumbnailUrl: thumbnailUrl,
          fileType: file.type,
          size: file.size,
          // numberOfChunks: numberOfChunks,
          // chunkSize: chunkSize
        }
      ]
    }

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { modelId, id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { stackId: modelId, transactionId: id };
  }

  async stackUploadRevision(file: any, progressHook?: (progress: number) => void): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: commands.STACK_WRITE,
      ...await this.prepareHeader()
    }

    const { resourceUrl, thumbnailUrl } = await this._postFile(file, progressHook);

    const body = {
      files: [
        {
          postedAt: new Date(),
          title: await this.processWriteString(file.name),
          resourceUrl: resourceUrl,
          thumbnailUrl: thumbnailUrl,
          fileType: file.type,
          size: file.size,
          // numberOfChunks: numberOfChunks,
          // chunkSize: chunkSize
        }
      ]
    }

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async nodeRestore(): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: "akord:" + this._getObjectTypeLowerCase() + ":restore",
      ... await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { status: "ACTIVE" }
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async nodeDelete(): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: "akord:" + this.objectType.toLowerCase() + ":delete",
      ... await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { status: "DELETED" }
    )
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async noteCreate(name: string, content: string, parentId?: string): Promise<{
    noteId: string,
    transactionId: string
  }> {
    const header = {
      schemaUri: commands.NOTE_WRITE,
      dataRoomId: this.vaultId,
      folderId: parentId,
      ...await this.prepareHeader()
    }

    const body = {
      status: "ACTIVE",
      revisions: [{
        title: await this.processWriteString(name),
        content: await this.processWriteString(content),
        size: Buffer.byteLength(content, 'utf8'),
        postedAt: new Date()
      }]
    };

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { modelId, id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { noteId: modelId, transactionId: id };
  }

  async noteUploadRevision(name: string, content: string): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: commands.NOTE_WRITE,
      ... await this.prepareHeader()
    }

    const body = {
      revisions: [{
        title: await this.processWriteString(name),
        content: await this.processWriteString(content),
        size: Buffer.byteLength(content, 'utf8'),
        postedAt: new Date()
      }]
    };

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async memoCreate(message: string): Promise<{ memoId: string, transactionId: string }> {
    const header = {
      schemaUri: commands.MEMO_WRITE,
      dataRoomId: this.vaultId,
      ...await this.prepareHeader()
    }

    const body = {
      message: await this.processWriteString(message)
    };

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { modelId, id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { memoId: modelId, transactionId: id };
  }

  async memoAddReaction(reaction: reactionEmoji, author: string): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: commands.MEMO_ADD_REACTION,
      ...await this.prepareHeader()
    }

    const body = {
      reactions: [{
        reaction: await this.processWriteString(reaction),
        name: await this.processWriteString(author),
        publicSigningKey: await this.wallet.signingPublicKey(),
        status: "ACTIVE",
        postedAt: new Date()
      }]
    };

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async memoRemoveReaction(reaction: reactionEmoji): Promise<{ transactionId: string }> {
    const header = {
      schemaUri: commands.MEMO_REMOVE_REACTION,
      ...await this.prepareHeader()
    }

    const reactionToRemove = await this.getReaction(reaction);

    const body = {
      reactions: [{
        ...reactionToRemove,
        status: "DELETED"
      }]
    };

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async vaultCreate(name: string, termsOfAccess: string, memberDetails: any, isPublic?: boolean): Promise<{
    vaultId: string,
    membershipId: string,
    transactionId: string
  }> {
    this.setIsPublic(isPublic);

    let publicKeys: any, keys: any;
    if (!this.isPublic) {
      const keyPair = await generateKeyPair();
      publicKeys = [arrayToBase64(keyPair.publicKey)];
      this.setRawDataEncryptionPublicKey(keyPair.publicKey);

      this.setRawKeysEncryptionPublicKey(await this.wallet.publicKeyRaw());
      const { encPrivateKey } = await this.keysEncrypter.encryptMemberKey(keyPair);
      keys = [
        {
          publicKey: arrayToBase64(keyPair.publicKey),
          encPrivateKey: encPrivateKey
        }
      ]
      this.setKeys(keys);
    }

    const headerPayload = {
      schemaUri: commands.VAULT_WRITE,
      ...await this.prepareHeader()
    };

    const body = {
      title: await this.processWriteString(name),
      termsOfAccess: jsonToBase64({
        termsOfAccess: termsOfAccess,
        hasTerms: true
      }),
      status: "ACTIVE",
      isPublic,
      publicKeys
    }

    let encodedTransaction = await this.encodeTransaction(headerPayload, body)

    const { dataRoomId, id } = await this.api.postLedgerTransaction([encodedTransaction]);
    this.setVaultId(dataRoomId);

    this.setActionRef(actionRefs.MEMBERSHIP_OWNER);

    const header = {
      schemaUri: commands.MEMBERSHIP_OWNER,
      dataRoomId: this.vaultId,
      ...await this.prepareHeader()
    }

    encodedTransaction = await this.encodeTransaction(
      header,
      {
        status: "ACCEPTED",
        role: "OWNER",
        memberDetails: {
          publicSigningKey: headerPayload.publicSigningKey,
          email: memberDetails.email,
          ...await this.processMemberDetails(memberDetails)
        },
        keys
      }
    )
    const { modelId } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { vaultId: this.vaultId, membershipId: modelId, transactionId: id };
  }

  async _prepareMemberKeys() {
    let memberKeys = {} as any
    const keys = await this.keysEncrypter.encryptMemberKeys([]);
    if (this.keysEncrypter.encAccessKey) {
      memberKeys.encAccessKey = keys;
    } else {
      memberKeys.keys = (<any>keys).map((keyPair) => {
        delete keyPair.encPublicKey;
        return keyPair;
      })
    }
    return memberKeys;
  }

  async membershipInvite(email: string, role: string): Promise<{ membershipId: string; transactionId: string; }> {
    const results = await this.api.preInviteCheck([email], this.vaultId);

    this.setKeysEncryptionPublicKey(results[0].publicKey);

    const header = {
      schemaUri: commands.MEMBERSHIP_INVITE,
      dataRoomId: this.vaultId,
      ...await this.prepareHeader()
    }

    const body = {
      role,
      memberDetails: {
        email: email,
        publicSigningKey: results[0].publicSigningKey
      },
      status: "PENDING",
      ...await this._prepareMemberKeys()
    }

    const encodedTransaction = await this.encodeTransaction(header, body);

    const { modelId, id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { membershipId: modelId, transactionId: id };
  }

  async membershipInviteNewUser(email: string, role: string): Promise<{ membershipId: string; transactionId: string; }> {
    const header = {
      schemaUri: commands.MEMBERSHIP_INVITE_NEW_USER,
      dataRoomId: this.vaultId,
      ...await this.prepareHeader()
    }

    const body = {
      role,
      memberDetails: {
        email: email
      },
      status: "INVITED"
    }
    const encodedTransaction = await this.encodeTransaction(header, body);

    const { modelId, id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { membershipId: modelId, transactionId: id };
  }

  async membershipInviteNewUserResend(): Promise<{ transactionId: string; }> {
    const header = {
      schemaUri: commands.MEMBERSHIP_INVITE_NEW_USER,
      ...await this.prepareHeader()
    }
    const encodedTransaction = await this.encodeTransaction(header, {});

    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async membershipInviteResend(): Promise<{ transactionId: string; }> {
    const header = {
      schemaUri: commands.MEMBERSHIP_INVITE,
      ...await this.prepareHeader()
    }
    const encodedTransaction = await this.encodeTransaction(header, {});

    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async membershipRevoke(): Promise<{ transactionId: string }> {
    let transactions = []

    const header = {
      schemaUri: commands.MEMBERSHIP_REVOKE,
      ...await this.prepareHeader()
    }

    const encodedTransaction = await this.encodeTransaction(
      header,
      { status: "REVOKED" }
    )
    transactions.push(encodedTransaction)

    if (!this.isPublic && this.dataEncrypter instanceof KeysStructureEncrypter) {
      const keyPair = await generateKeyPair()
      const headerPayload = {
        prevHash: this.vault.hash,
        actionRef: actionRefs.VAULT_KEY_ROTATE,
        publicSigningKey: await this.wallet.signingPublicKey(),
        postedAt: new Date(),
        schemaUri: commands.VAULT_WRITE

      };
      const body = { publicKeys: [arrayToBase64(keyPair.publicKey)] }

      this.setRawDataEncryptionPublicKey(keyPair.publicKey)

      const encodedTransaction = await this.encodeTransaction(
        headerPayload,
        body
      )
      transactions.push(encodedTransaction)

      let emails = []

      const memberships = await this.api.getObjectsByVaultId(this.vaultId, "Membership");
      memberships.map(async (member: any) => {
        if (member.memberPublicSigningKey
          && this.object.state.memberDetails.publicSigningKey !== member.memberPublicSigningKey
          && (member.status === 'ACCEPTED' || member.status === 'PENDING')
        ) {
          emails.push(member.state.memberDetails.email);
        }
      });

      if (emails.length > 0) {
        const results = await this.api.preInviteCheck(emails, this.vaultId);

        const memberKeysPromises = results.map(async (member: any) => {
          const memberKeysEncrypter = new KeysStructureEncrypter(
            this.wallet,
            (<KeysStructureEncrypter>this.keysEncrypter).keys,
            member.publicKey
          );
          memberKeysEncrypter.setPublicKey(member.publicKey);
          const { encPrivateKey } = await memberKeysEncrypter.encryptMemberKey(keyPair)
          const keys = [{
            publicKey: arrayToBase64(keyPair.publicKey),
            encPrivateKey: encPrivateKey
          }];
          const headerPayload = {
            prevHash: member.membership.hash,
            actionRef: actionRefs.MEMBERSHIP_KEY_ROTATE,
            publicSigningKey: await this.wallet.signingPublicKey(),
            postedAt: new Date(),
            schemaUri: commands.MEMBERSHIP_WRITE
          };
          const encodedTransaction = await this.encodeTransaction(
            headerPayload,
            { keys }
          )
          transactions.push(encodedTransaction)
        })
        await Promise.all(memberKeysPromises)
      }
    }
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async membershipConfirm(): Promise<{ transactionId: string }> {
    const results = await this.api.preInviteCheck([this.object.email], this.vaultId);

    this.setKeysEncryptionPublicKey(results[0].publicKey);

    const header = {
      schemaUri: commands.MEMBERSHIP_CONFIRM,
      ...await this.prepareHeader()
    }

    const body = {
      memberDetails: {
        publicSigningKey: results[0].publicSigningKey
      },
      status: "PENDING",
      ...await this._prepareMemberKeys()
    }

    const encodedTransaction = await this.encodeTransaction(header, body);
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async profileUpdate(name: string, avatar: any): Promise<{ transactionId: string; }> {
    if (!name && !avatar) {
      throw new Error("Nothing to update.");
    }
    const signingPublicKey = await this.wallet.signingPublicKey();
    const profile = await this.api.getProfileByPublicSigningKey(signingPublicKey);
    this.setPrevHash(profile.hash);

    this.setRawDataEncryptionPublicKey(await this.wallet.publicKeyRaw());
    this.setIsPublic(false);
    const profileDetails = await this.processMemberDetails({ fullName: name, avatar });

    // merge & upload current profile state to Arweave
    const currentProfileDetails = profile.state.profileDetails;
    const mergedProfileDetails = {
      fullName: profileDetails.fullName || currentProfileDetails.fullName,
      avatarTx: profileDetails.avatarTx || currentProfileDetails.avatarTx,
    }

    this.tags = { ["Signer-Address"]: await this.wallet.getAddress() };

    // upload profile state to Arweave
    const { metadata } = await this._uploadBody({ profileDetails: mergedProfileDetails });
    const header = {
      schemaUri: commands.PROFILE_WRITE,
      stateRef: metadata.dataRefs[0].resourceUrl,
      ...await this.prepareHeader()
    }
    const encodedTransaction = await this.encodeTransaction(header, { profileDetails, encryptionType: EncryptionType.KEYS_STRUCTURE });
    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  chunkTransactions(transactions: any[]): any[] {
    return transactions.reduce((resultArray, item, index) => {
      const chunkIndex = Math.floor(index / BATCH_TRANSACTION_LIMIT);
      if (!resultArray[chunkIndex]) {
        resultArray[chunkIndex] = [];
      }
      resultArray[chunkIndex].push(item);
      return resultArray;
    }, []);
  }

  async postLedgerBatchTransaction(transactions: any[]) {
    const chunkedTransactions = this.chunkTransactions(transactions);
    await Promise.all(
      chunkedTransactions.map(
        async (transactionsChunk: any[]) => this.api.postLedgerTransaction(transactionsChunk)
      )
    );
  }

  async prepareHeader() {
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
  async encodeTransaction(header: any, body: any) {
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
  LedgerService
}