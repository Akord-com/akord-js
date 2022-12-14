import { NodeService } from "./node";
import { actionRefs, objectTypes, status, commands, protocolTags } from "../constants";
import { v4 as uuidv4 } from "uuid";
import { generateKeyPair, arrayToBase64, KeysStructureEncrypter } from "@akord/crypto";

class MembershipService extends NodeService {
  objectType: string = objectTypes.MEMBERSHIP;

  /**
  * Invite user with an Akord account
  * @param  {string} vaultId
  * @param  {string} email invitee's email
  * @param  {string} role CONTRIBUTOR or VIEWER
  * @returns Promise with new membership id & corresponding transaction id
  */
  public async invite(vaultId: string, email: string, role: string): Promise<{
    membershipId: string,
    transactionId: string
  }> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.MEMBERSHIP_INVITE);
    this.setCommand(commands.MEMBERSHIP_INVITE);
    const membershipId = uuidv4();
    this.setObjectId(membershipId);

    const { address, publicKey } = await this.getUserEncryptionInfo(email);
    this.setRawKeysEncryptionPublicKey(publicKey);
    const keys = await this.keysEncrypter.encryptMemberKeys([]);
    const body = {
      keys: (<any>keys).map((keyPair) => {
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

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async accept(membershipId: string): Promise<{ transactionId: string }> {
    const memberDetails = await this.getProfileDetails();
    await this.setVaultContextFromObjectId(membershipId, this.objectType);
    this.setActionRef(actionRefs.MEMBERSHIP_ACCEPT);
    const body = {
      memberDetails: await this.processMemberDetails(memberDetails, true),
      encPublicSigningKey: [await this.processWriteString(await this.wallet.signingPublicKey())]
    }
    this.setCommand(commands.MEMBERSHIP_ACCEPT);
    return this.nodeUpdate(body);
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async confirm(membershipId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(membershipId, this.objectType);
    this.setActionRef(actionRefs.MEMBERSHIP_CONFIRM);
    this.setCommand(commands.MEMBERSHIP_INVITE);
    const { address, publicKey } = await this.getUserEncryptionInfo(this.object.email);
    this.setRawKeysEncryptionPublicKey(publicKey);
    const keys = await this.keysEncrypter.encryptMemberKeys([]);
    const body = {
      keys: (<any>keys).map((keyPair) => {
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

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async reject(membershipId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(membershipId, this.objectType);
    this.setActionRef(actionRefs.MEMBERSHIP_REJECT);
    this.setCommand(commands.MEMBERSHIP_REJECT);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async leave(membershipId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(membershipId, this.objectType);
    this.setActionRef(actionRefs.MEMBERSHIP_LEAVE);
    this.setCommand(commands.MEMBERSHIP_REJECT);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async revoke(membershipId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(membershipId, this.objectType);
    this.setCommand(commands.MEMBERSHIP_REVOKE);

    let data: any, metadata: any;
    if (!this.isPublic) {
      // generate a new vault key pair
      const keyPair = await generateKeyPair();

      const memberships = await this.api.getObjectsByVaultId(this.vaultId, this.objectType);

      this.tags = await this.getTags();

      let newMembershipStates = [];
      let newMembershipRefs = [];
      for (let member of memberships) {
        if (member.id !== this.objectId
          && (member.status === status.ACCEPTED || member.status === status.PENDING)) {
          const { publicKey } = await this.getUserEncryptionInfo(member.email, member.address);
          const memberKeysEncrypter = new KeysStructureEncrypter(
            this.wallet,
            (<any>this.keysEncrypter).keys,
            publicKey
          );
          const keys = [await memberKeysEncrypter.encryptMemberKey(keyPair)];
          const newState = await this.mergeState(member.id, this.objectType, { keys });
          const signature = await this.signData(newState);
          newMembershipStates.push({
            body: newState, tags: {
              "Data-Type": "State",
              [protocolTags.SIGNATURE]: signature,
              [protocolTags.SIGNER_ADDRESS]: this.tags[protocolTags.SIGNER_ADDRESS],
              [protocolTags.VAULT_ID]: this.tags[protocolTags.VAULT_ID],
              [protocolTags.NODE_TYPE]: this.objectType,
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
        metadata.dataRefs.push({ ...ids[memberIndex], modelId: memberId, modelType: objectTypes.MEMBERSHIP });
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

  /**
   * @param  {string} membershipId
   * @param  {string} role CONTRIBUTOR or VIEWER
   * @returns Promise with corresponding transaction id
   */
  public async changeRole(membershipId: string, role: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(membershipId, this.objectType);
    this.setActionRef(actionRefs.MEMBERSHIP_CHANGE_ROLE);
    this.setCommand(commands.MEMBERSHIP_CHANGE_ROLE);
    return this.nodeUpdate(null, { role });
  }

  /**
  * Invite user without an Akord account
  * @param  {string} vaultId
  * @param  {string} email invitee's email
  * @param  {string} role CONTRIBUTOR or VIEWER
  * @returns Promise with new membership id & corresponding transaction id
  */
  public async inviteNewUser(vaultId: string, email: string, role: string): Promise<{
    membershipId: string,
    transactionId: string
  }> {
    this.setVaultId(vaultId);
    this.setActionRef(actionRefs.MEMBERSHIP_INVITE);
    const header = {
      schemaUri: "akord:membership:invite-new-user",
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

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async inviteResend(membershipId: string): Promise<{ transactionId: string }> {
    const object = await this.api.getObject(membershipId, this.objectType);
    this.setVaultId(object.dataRoomId);
    this.setPrevHash(object.hash);
    this.setObjectId(membershipId);
    this.setObject(object);
    this.setActionRef(actionRefs.MEMBERSHIP_INVITE_RESEND);
    let schemaUri: string;
    if (object.status === status.PENDING) {
      schemaUri = 'akord:membership:invite';
    } else if (object.status === status.INVITED) {
      schemaUri = 'akord:membership:invite-new-user';
    } else {
      throw new Error("Cannot resend the invitation for member: " + membershipId +
        ". Found invalid status: " + object.status);
    }
    const header = {
      schemaUri,
      ...await this.prepareHeader()
    }
    const encodedTransaction = await this.encodeTransaction(header, {});

    const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
    return { transactionId: id };
  }

  async profileUpdate(membershipId: string, name: string, avatar: any): Promise<{ transactionId: string; }> {
    await this.setVaultContextFromObjectId(membershipId, objectTypes.MEMBERSHIP);
    this.setActionRef(actionRefs.MEMBERSHIP_PROFILE_UPDATE);
    const memberDetails = await this.processMemberDetails({ fullName: name, avatar }, true);
    this.setCommand(commands.MEMBERSHIP_UPDATE);
    return this.nodeUpdate({ memberDetails });
  }
};

export {
  MembershipService
}
