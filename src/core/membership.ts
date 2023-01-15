import { actionRefs, objectTypes, status, functions, protocolTags } from "../constants";
import { v4 as uuidv4 } from "uuid";
import { generateKeyPair, KeysStructureEncrypter } from "@akord/crypto";
import { Service } from "./service";
import { Membership } from "../types/membership";
import { defaultListOptions } from "../types/list-options";
import { Tag, Tags } from "../types/contract";

class MembershipService extends Service {
  objectType: string = objectTypes.MEMBERSHIP;

  /**
   * @param  {string} membershipId
   * @returns Promise with the decrypted membership
   */
  public async get(membershipId: string, vaultId?: string, shouldDecrypt = true): Promise<Membership> {
    const membershipProto = await this.api.getObject<any>(membershipId, this.objectType, vaultId);
    let membership: Membership;
    if (shouldDecrypt) {
      const { isEncrypted, keys } = await this.api.getMembershipKeys(membershipProto.vaultId, this.wallet);
      membership = new Membership(membershipProto, keys);
      if (isEncrypted) {
        await membership.decrypt();
      }
    }
    else {
      membership = new Membership(membershipProto);
    }
    return membership
  }

  /**
   * @param  {string} vaultId
   * @returns Promise with the decrypted memberships
   */
  public async list(vaultId: string, listOptions = defaultListOptions): Promise<Array<Membership>> {
    const membershipsProto = await this.api.getObjectsByVaultId<Membership>(vaultId, this.objectType, listOptions.shouldListAll);
    const { isEncrypted, keys } = await this.api.getMembershipKeys(vaultId, this.wallet);
    const memberships = []
    for (const membershipProto of membershipsProto) {
      const membership = new Membership(membershipProto, keys);
      if (isEncrypted && listOptions.shouldDecrypt) {
        await membership.decrypt();
      }
      memberships.push(membership);
    }
    return memberships;
  }

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
    this.setFunction(functions.MEMBERSHIP_INVITE);
    const membershipId = uuidv4();
    this.setObjectId(membershipId);

    const { address, publicKey } = await this.getUserEncryptionInfo(email, await this.wallet.getAddress());
    const keysEncrypter = new KeysStructureEncrypter(this.wallet, (<any>this.dataEncrypter).keys, publicKey);
    const keys = await keysEncrypter.encryptMemberKeys([]);
    const body = {
      keys: (<any>keys).map((keyPair) => {
        delete keyPair.publicKey;
        return keyPair;
      })
    }

    this.tags = [new Tag(protocolTags.MEMBER_ADDRESS, address)]
      .concat(await this.getTags());

    const { data, metadata } = await this.uploadState(body);

    let input = {
      function: this.function,
      address,
      role,
      data
    }

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      input,
      this.tags,
      metadata
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
      encPublicSigningKey: await this.processWriteString(await this.wallet.signingPublicKey())
    }
    this.setFunction(functions.MEMBERSHIP_ACCEPT);
    return this.nodeUpdate(body);
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async confirm(membershipId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(membershipId, this.objectType);
    this.setActionRef(actionRefs.MEMBERSHIP_CONFIRM);
    this.setFunction(functions.MEMBERSHIP_INVITE);
    const { address, publicKey } = await this.getUserEncryptionInfo(this.object.email, await this.wallet.getAddress());
    const keysEncrypter = new KeysStructureEncrypter(this.wallet, (<any>this.dataEncrypter).keys, publicKey);
    const keys = await keysEncrypter.encryptMemberKeys([]);
    const body = {
      keys: (<any>keys).map((keyPair) => {
        delete keyPair.publicKey;
        return keyPair;
      })
    };
    this.tags = [new Tag(protocolTags.MEMBER_ADDRESS, address)]
      .concat(await this.getTags());

    const { data, metadata } = await this.uploadState(body);

    let input = {
      function: this.function,
      address,
      data,
      role: this.object.role
    }

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      input,
      this.tags,
      metadata
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
    this.setFunction(functions.MEMBERSHIP_REJECT);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async leave(membershipId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(membershipId, this.objectType);
    this.setActionRef(actionRefs.MEMBERSHIP_LEAVE);
    this.setFunction(functions.MEMBERSHIP_REJECT);
    return this.nodeUpdate();
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async revoke(membershipId: string): Promise<{ transactionId: string }> {
    await this.setVaultContextFromObjectId(membershipId, this.objectType);
    this.setFunction(functions.MEMBERSHIP_REVOKE);

    let data: any;
    if (!this.isPublic) {
      // generate a new vault key pair
      const keyPair = await generateKeyPair();

      const memberships = await this.api.getObjectsByVaultId<Membership>(this.vaultId, this.objectType);

      this.tags = await this.getTags();

      let newMembershipStates = [] as { data: any, tags: Tags }[];
      let newMembershipRefs = [];
      for (let member of memberships) {
        if (member.id !== this.objectId
          && (member.status === status.ACCEPTED || member.status === status.PENDING)) {
          const { publicKey } = await this.getUserEncryptionInfo(member.email, member.address);
          const memberKeysEncrypter = new KeysStructureEncrypter(
            this.wallet,
            (<any>this.dataEncrypter).keys,
            publicKey
          );
          const keys = [await memberKeysEncrypter.encryptMemberKey(keyPair)];
          const newState = await this.mergeState({ keys });
          const signature = await this.signData(newState);
          newMembershipStates.push({
            data: newState, tags: [
              new Tag("Data-Type", "State"),
              new Tag(protocolTags.SIGNATURE, signature),
              new Tag(protocolTags.SIGNER_ADDRESS, await this.wallet.getAddress()),
              new Tag(protocolTags.VAULT_ID, this.vaultId),
              new Tag(protocolTags.NODE_TYPE, this.objectType),
              new Tag(protocolTags.MEMBERSHIP_ID, member.id)
            ]
          });
          newMembershipRefs.push(member.id);
        }
      }
      const ids = await this.api.uploadData(newMembershipStates, true);
      data = [];

      newMembershipRefs.forEach((memberId, memberIndex) => {
        data.push({ id: memberId, value: ids[memberIndex].id })
      })
    }

    const txId = await this.api.postContractTransaction(
      this.vaultId,
      { function: this.function, data },
      this.tags
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
    this.setFunction(functions.MEMBERSHIP_CHANGE_ROLE);
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
    membershipId: string
  }> {
    const { id } = await this.api.inviteNewUser(vaultId, email, role);
    return { membershipId: id };
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async inviteResend(membershipId: string): Promise<void> {
    const object = await this.api.getObject<Membership>(membershipId, this.objectType, this.vaultId);
    this.setActionRef(actionRefs.MEMBERSHIP_INVITE_RESEND);
    if (object.status !== status.PENDING && object.status !== status.INVITED) {
      throw new Error("Cannot resend the invitation for member: " + membershipId +
        ". Found invalid status: " + object.status);
    }
    await this.api.inviteResend(object.vaultId, membershipId);
  }

  async profileUpdate(membershipId: string, name: string, avatar: any): Promise<{ transactionId: string; }> {
    await this.setVaultContextFromObjectId(membershipId, objectTypes.MEMBERSHIP);
    this.setActionRef(actionRefs.MEMBERSHIP_PROFILE_UPDATE);
    const memberDetails = await this.processMemberDetails({ name, avatar }, true);
    this.setFunction(functions.MEMBERSHIP_UPDATE);
    return this.nodeUpdate({ memberDetails });
  }
};

export {
  MembershipService
}
