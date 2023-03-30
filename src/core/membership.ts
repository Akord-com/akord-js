import { actionRefs, objectType, status, functions, protocolTags, smartweaveTags } from "../constants";
import { v4 as uuidv4 } from "uuid";
import { EncryptedKeys, Encrypter, generateKeyPair } from "@akord/crypto";
import { Service, STATE_CONTENT_TYPE } from "./service";
import { Membership, RoleType } from "../types/membership";
import { ListOptions } from "../types/list-options";
import { Tag, Tags } from "../types/contract";
import { Paginated } from "../types/paginated";
import { BadRequest } from "../errors/bad-request";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";

type MembershipCreateResult = {
  membershipId: string,
  transactionId: string,
  object: Membership
}

type MembershipUpdateResult = {
  transactionId: string,
  object: Membership
}

class MembershipService extends Service {
  objectType = objectType.MEMBERSHIP;

  defaultListOptions = {
    shouldDecrypt: true,
    filter: {
      or: [
        { status: { eq: status.ACCEPTED } },
        { status: { eq: status.PENDING } }
      ]
    }
  } as ListOptions;

  /**
   * @param  {string} membershipId
   * @returns Promise with the decrypted membership
   */
  public async get(membershipId: string, vaultId?: string, shouldDecrypt = true): Promise<Membership> {
    const membershipProto = await this.api.getMembership(membershipId, vaultId);
    let membership: Membership;
    if (shouldDecrypt) {
      const { isEncrypted, keys } = await this.api.getMembershipKeys(membershipProto.vaultId);
      membership = await this.processMembership(membershipProto, isEncrypted, keys);
    }
    else {
      membership = new Membership(membershipProto);
    }
    return membership
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} listOptions
   * @returns Promise with paginated memberships within given vault
   */
  public async list(vaultId: string, listOptions: ListOptions = this.defaultListOptions): Promise<Paginated<Membership>> {
    const response = await this.api.getMembershipsByVaultId(vaultId, listOptions.filter, listOptions.limit, listOptions.nextToken);
    const { isEncrypted, keys } = listOptions.shouldDecrypt ? await this.api.getMembershipKeys(vaultId) : { isEncrypted: false, keys: [] };
    return {
      items: await Promise.all(
        response.items
          .map(async (membershipProto: Membership) => {
            return await this.processMembership(membershipProto, isEncrypted && listOptions.shouldDecrypt, keys);
          })) as Membership[],
      nextToken: response.nextToken
    }
  }

  /**
  * @param  {string} vaultId
  * @param  {ListOptions} listOptions
  * @returns Promise with all memberships within given vault
  */
  public async listAll(vaultId: string, listOptions: ListOptions = this.defaultListOptions): Promise<Array<Membership>> {
    let token = null;
    let nodeArray = [] as Membership[];
    do {
      const { items, nextToken } = await this.list(vaultId, listOptions);
      nodeArray = nodeArray.concat(items);
      token = nextToken;
      listOptions.nextToken = nextToken;
      if (nextToken === "null") {
        token = null;
      }
    } while (token);
    return nodeArray;
  }

  /**
   * Invite user with an Akord account
   * @param  {string} vaultId
   * @param  {string} email invitee's email
   * @param  {RoleType} role CONTRIBUTOR or VIEWER
   * @returns Promise with new membership id & corresponding transaction id
   */
  public async invite(vaultId: string, email: string, role: RoleType): Promise<MembershipCreateResult> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.MEMBERSHIP_INVITE);
    this.setFunction(functions.MEMBERSHIP_INVITE);
    const membershipId = uuidv4();
    this.setObjectId(membershipId);

    const { address, publicKey } = await this.getUserEncryptionInfo(email, await this.wallet.getAddress());
    const keysEncrypter = new Encrypter(this.wallet, this.dataEncrypter.keys, publicKey);
    let keys: EncryptedKeys[];
    try {
      keys = await keysEncrypter.encryptMemberKeys([]);
    } catch (error) {
      throw new IncorrectEncryptionKey(error);
    }
    const body = {
      keys: keys.map((keyPair: any) => {
        delete keyPair.publicKey;
        return keyPair;
      })
    }

    this.tags = [new Tag(protocolTags.MEMBER_ADDRESS, address)]
      .concat(await this.getTags());

    const dataTxId = await this.uploadState(body);

    let input = {
      function: this.function,
      address,
      role,
      data: dataTxId
    }

    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      input,
      this.tags
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { membershipId, transactionId: id, object: membership };
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async accept(membershipId: string): Promise<MembershipUpdateResult> {
    const memberDetails = await this.getProfileDetails();
    await this.setVaultContextFromMembershipId(membershipId);
    const body = {
      memberDetails: await this.processMemberDetails(memberDetails, true),
      encPublicSigningKey: await this.processWriteString(this.wallet.signingPublicKey())
    }
    this.setActionRef(actionRefs.MEMBERSHIP_ACCEPT);
    this.setFunction(functions.MEMBERSHIP_ACCEPT);

    const data = await this.mergeAndUploadBody(body);
    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      { function: this.function, data },
      await this.getTags()
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { transactionId: id, object: membership };
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async confirm(membershipId: string): Promise<MembershipUpdateResult> {
    await this.setVaultContextFromMembershipId(membershipId);
    this.setActionRef(actionRefs.MEMBERSHIP_CONFIRM);
    this.setFunction(functions.MEMBERSHIP_INVITE);
    const { address, publicKey } = await this.getUserEncryptionInfo(this.object.email, await this.wallet.getAddress());
    const keysEncrypter = new Encrypter(this.wallet, this.dataEncrypter.keys, publicKey);
    let keys: EncryptedKeys[];
    try {
      keys = await keysEncrypter.encryptMemberKeys([]);
    } catch (error) {
      throw new IncorrectEncryptionKey(error);
    }
    const body = {
      keys: keys.map((keyPair: any) => {
        delete keyPair.publicKey;
        return keyPair;
      })
    }
    this.tags = [new Tag(protocolTags.MEMBER_ADDRESS, address)]
      .concat(await this.getTags());

    const dataTxId = await this.uploadState(body);

    let input = {
      function: this.function,
      address,
      data: dataTxId,
      role: this.object.role
    }

    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      input,
      this.tags
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { transactionId: id, object: membership };
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async reject(membershipId: string): Promise<MembershipUpdateResult> {
    await this.setVaultContextFromMembershipId(membershipId);
    this.setActionRef(actionRefs.MEMBERSHIP_REJECT);
    this.setFunction(functions.MEMBERSHIP_REJECT);

    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      { function: this.function },
      await this.getTags()
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { transactionId: id, object: membership };
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async leave(membershipId: string): Promise<MembershipUpdateResult> {
    await this.setVaultContextFromMembershipId(membershipId);
    this.setActionRef(actionRefs.MEMBERSHIP_LEAVE);
    this.setFunction(functions.MEMBERSHIP_REJECT);

    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      { function: this.function },
      await this.getTags()
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { transactionId: id, object: membership };
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async revoke(membershipId: string): Promise<MembershipUpdateResult> {
    await this.setVaultContextFromMembershipId(membershipId);
    this.setActionRef(actionRefs.MEMBERSHIP_REVOKE);
    this.setFunction(functions.MEMBERSHIP_REVOKE);

    let data: any;
    if (!this.isPublic) {
      // generate a new vault key pair
      const keyPair = await generateKeyPair();

      const memberships = await this.listAll(this.vaultId, { shouldDecrypt: false, filter: this.defaultListOptions.filter });

      this.tags = await this.getTags();

      let newMembershipStates = [] as { data: any, tags: Tags }[];
      let newMembershipRefs = [];
      for (let member of memberships) {
        if (member.id !== this.objectId
          && (member.status === status.ACCEPTED || member.status === status.PENDING)) {
          const { publicKey } = await this.getUserEncryptionInfo(member.memberDetails.email, member.address);
          const memberKeysEncrypter = new Encrypter(
            this.wallet,
            this.dataEncrypter.keys,
            publicKey
          );
          let keys: EncryptedKeys[];;
          try {
            keys = [await memberKeysEncrypter.encryptMemberKey(keyPair)];
          } catch (error) {
            throw new IncorrectEncryptionKey(error);
          }
          const newState = await this.mergeState({ keys });
          const signature = await this.signData(newState);
          newMembershipStates.push({
            data: newState, tags: [
              new Tag("Data-Type", "State"),
              new Tag(smartweaveTags.CONTENT_TYPE, STATE_CONTENT_TYPE),
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
      const dataTxIds = await this.api.uploadData(newMembershipStates, true);
      data = [];

      newMembershipRefs.forEach((memberId, memberIndex) => {
        data.push({ id: memberId, value: dataTxIds[memberIndex] })
      })
    }

    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      { function: this.function, data },
      this.tags
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { transactionId: id, object: membership };
  }

  /**
   * @param  {string} membershipId
   * @param  {RoleType} role CONTRIBUTOR or VIEWER
   * @returns Promise with corresponding transaction id
   */
  public async changeRole(membershipId: string, role: RoleType): Promise<MembershipUpdateResult> {
    await this.setVaultContextFromMembershipId(membershipId);
    this.setActionRef(actionRefs.MEMBERSHIP_CHANGE_ROLE);
    this.setFunction(functions.MEMBERSHIP_CHANGE_ROLE);

    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      { function: this.function, role },
      await this.getTags()
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { transactionId: id, object: membership };
  }

  /**
   * Invite user without an Akord account
   * @param  {string} vaultId
   * @param  {string} email invitee's email
   * @param  {string} role CONTRIBUTOR or VIEWER
   * @returns Promise with new membership id & corresponding transaction id
   */
  public async inviteNewUser(vaultId: string, email: string, role: RoleType): Promise<{
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
    const object = await this.api.getMembership(membershipId, this.vaultId);
    this.setActionRef(actionRefs.MEMBERSHIP_INVITE_RESEND);
    if (object.status !== status.PENDING && object.status !== status.INVITED) {
      throw new BadRequest("Cannot resend the invitation for member: " + membershipId +
        ". Found invalid status: " + object.status);
    }
    await this.api.inviteResend(object.vaultId, membershipId);
  }

  async profileUpdate(membershipId: string, name: string, avatar: any): Promise<MembershipUpdateResult> {
    await this.setVaultContextFromMembershipId(membershipId);
    const memberDetails = await this.processMemberDetails({ name, avatar }, true);
    this.setActionRef(actionRefs.MEMBERSHIP_PROFILE_UPDATE);
    this.setFunction(functions.MEMBERSHIP_UPDATE);

    const data = await this.mergeAndUploadBody({ memberDetails });
    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      { function: this.function, data },
      await this.getTags()
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { transactionId: id, object: membership };
  }

  protected async setVaultContextFromMembershipId(membershipId: string, vaultId?: string) {
    const membership = await this.api.getMembership(membershipId, vaultId);
    await this.setVaultContext(vaultId || membership.vaultId);
    this.setObject(membership);
    this.setObjectId(membershipId);
    this.setObjectType(this.objectType);
  }

  protected async getTags(): Promise<Tags> {
    const tags = await super.getTags();
    return tags.concat(new Tag(protocolTags.MEMBERSHIP_ID, this.objectId));
  }

  protected async processMembership(object: Membership, shouldDecrypt: boolean, keys?: EncryptedKeys[]): Promise<Membership> {
    const membership = new Membership(object, keys);
    if (shouldDecrypt) {
      try {
        await membership.decrypt();
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
    return membership;
  }
};

export {
  MembershipService
}
