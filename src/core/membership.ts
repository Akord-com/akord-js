import { actionRefs, objectType, status, functions, protocolTags } from "../constants";
import { v4 as uuidv4 } from "uuid";
import { EncryptedKeys, Encrypter, deriveAddress, base64ToArray } from "@akord/crypto";
import { Service } from "./service";
import { Membership, RoleType, StatusType } from "../types/membership";
import { GetOptions, ListOptions } from "../types/query-options";
import { MembershipInput, Tag, Tags } from "../types/contract";
import { Paginated } from "../types/paginated";
import { BadRequest } from "../errors/bad-request";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";
import { UserPublicInfo } from "../types";

export const activeStatus = [status.ACCEPTED, status.PENDING, status.INVITED] as StatusType[];

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

  defaultGetOptions = {
    shouldDecrypt: true,
  } as GetOptions;

  /**
   * @param  {string} membershipId
   * @returns Promise with the decrypted membership
   */
  public async get(membershipId: string, options: GetOptions = this.defaultGetOptions): Promise<Membership> {
    const getOptions = {
      ...this.defaultGetOptions,
      ...options
    }
    const membershipProto = await this.api.getMembership(membershipId, getOptions.vaultId);
    return await this.processMembership(
      membershipProto,
      !membershipProto.__public__ && getOptions.shouldDecrypt,
      membershipProto.__keys__
    );
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} options
   * @returns Promise with paginated memberships within given vault
   */
  public async list(vaultId: string, options: ListOptions = this.defaultListOptions): Promise<Paginated<Membership>> {
    const listOptions = {
      ...this.defaultListOptions,
      ...options
    }
    const response = await this.api.getMembershipsByVaultId(vaultId, listOptions);
    const promises = response.items
      .map(async (membershipProto: Membership) => {
        return await this.processMembership(membershipProto, !membershipProto.__public__ && listOptions.shouldDecrypt, membershipProto.__keys__);
      }) as Promise<Membership>[];
    const { items, errors } = await this.handleListErrors<Membership>(response.items, promises);
    return {
      items,
      nextToken: response.nextToken,
      errors
    }
  }

  /**
   * @param  {string} vaultId
   * @param  {ListOptions} options
   * @returns Promise with all memberships within given vault
   */
  public async listAll(vaultId: string, options: ListOptions = this.defaultListOptions): Promise<Array<Membership>> {
    const list = async (options: ListOptions & { vaultId: string }) => {
      return await this.list(options.vaultId, options);
    }
    return await this.paginate<Membership>(list, { ...options, vaultId });
  }

  /**
   * Invite user with an Akord account
   * @param  {string} vaultId
   * @param  {string} email invitee's email
   * @param  {RoleType} role VIEWER/CONTRIBUTOR/OWNER
   * @param  {MembershipCreateOptions} [options] invitation email message, etc.
   * @returns Promise with new membership id & corresponding transaction id
   */
  public async invite(vaultId: string, email: string, role: RoleType, options: MembershipCreateOptions = {}): Promise<MembershipCreateResult> {
    await this.setVaultContext(vaultId);
    this.setActionRef(actionRefs.MEMBERSHIP_INVITE);
    this.setFunction(functions.MEMBERSHIP_INVITE);
    const membershipId = uuidv4();
    this.setObjectId(membershipId);

    const { address, publicKey, publicSigningKey } = await this.api.getUserPublicData(email);
    const state = {
      keys: await this.prepareMemberKeys(publicKey),
      encPublicSigningKey: await this.processWriteString(publicSigningKey)
    };

    this.arweaveTags = [new Tag(protocolTags.MEMBER_ADDRESS, address)]
      .concat(await this.getTags());

    const dataTxId = await this.uploadState(state);

    const input = {
      function: this.function,
      address,
      role,
      data: dataTxId
    }

    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      input,
      this.arweaveTags,
      { message: options.message }
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { membershipId, transactionId: id, object: membership };
  }

  /**
   * Airdrop access to the vaul directly through public keys
   * @param  {string} vaultId
   * @param  {{publicKey:string,publicSigningKey:string,role:RoleType}[]} members
   * @returns Promise with new memberships & corresponding transaction id
   */
  public async airdrop(
    vaultId: string,
    members: Array<{ publicKey: string, publicSigningKey: string, role: RoleType, options?: { email: string, expirationDate: Date } }>,
  ): Promise<{
    transactionId: string,
    members: Array<{ id: string, address: string }>
  }> {
    await this.setVaultContext(vaultId);
    this.setActionRef("MEMBERSHIP_AIRDROP");
    this.setFunction(functions.MEMBERSHIP_ADD);
    const memberArray = [] as MembershipInput[];
    const membersMetadata = [];
    const dataArray = [] as { id: string, data: string }[];
    const memberTags = [] as Tags;
    for (const member of members) {
      const membershipId = uuidv4();
      this.setObjectId(membershipId);

      const memberAddress = await deriveAddress(base64ToArray(member.publicSigningKey));

      const state = {
        id: membershipId,
        address: memberAddress,
        keys: await this.prepareMemberKeys(member.publicKey),
        encPublicSigningKey: await this.processWriteString(member.publicSigningKey)
      };

      const data = await this.uploadState(state);
      dataArray.push({
        id: membershipId,
        data
      })
      membersMetadata.push({
        address: memberAddress,
        publicKey: member.publicKey,
        publicSigningKey: member.publicSigningKey,
        options: member.options
      })
      memberArray.push({ address: memberAddress, id: membershipId, role: member.role, data });
      memberTags.push(new Tag(protocolTags.MEMBER_ADDRESS, memberAddress));
      memberTags.push(new Tag(protocolTags.MEMBERSHIP_ID, membershipId));
    }

    this.arweaveTags = memberTags.concat(await super.getTags());

    const input = {
      function: this.function,
      members: memberArray
    };

    const { id } = await this.api.postContractTransaction(
      this.vaultId,
      input,
      this.arweaveTags,
      { members: membersMetadata }
    );
    return { members: input.members, transactionId: id };
  }

  /**
   * @param  {string} membershipId
   * @returns Promise with corresponding transaction id
   */
  public async accept(membershipId: string): Promise<MembershipUpdateResult> {
    const memberDetails = await this.getProfileDetails();
    await this.setVaultContextFromMembershipId(membershipId);
    const state = {
      memberDetails: await this.processMemberDetails(memberDetails, this.object.__cacheOnly__),
      encPublicSigningKey: await this.processWriteString(this.wallet.signingPublicKey())
    }
    this.setActionRef(actionRefs.MEMBERSHIP_ACCEPT);
    this.setFunction(functions.MEMBERSHIP_ACCEPT);

    const data = await this.mergeAndUploadState(state);
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
    const { address, publicKey, publicSigningKey } = await this.api.getUserPublicData(this.object.email);

    const state = {
      keys: await this.prepareMemberKeys(publicKey),
      encPublicSigningKey: await this.processWriteString(publicSigningKey)
    };

    this.arweaveTags = [new Tag(protocolTags.MEMBER_ADDRESS, address)]
      .concat(await this.getTags());

    const dataTxId = await this.uploadState(state);

    const input = {
      function: this.function,
      address,
      data: dataTxId,
      role: this.object.role
    }

    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      input,
      this.arweaveTags
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

    this.arweaveTags = await this.getTags();

    let data: { id: string, value: string }[];
    if (!this.isPublic) {
      const memberships = await this.listAll(this.vaultId, { shouldDecrypt: false });

      const activeMembers = memberships.filter((member: Membership) =>
        member.id !== this.objectId
        && (member.status === status.ACCEPTED || member.status === status.PENDING));

      // rotate keys for all active members
      const memberPublicKeys = new Map<string, string>();
      await Promise.all(activeMembers.map(async (member: Membership) => {
        const { publicKey } = await this.api.getUserPublicData(member.email);
        memberPublicKeys.set(member.id, publicKey);
      }));
      const { memberKeys } = await this.rotateMemberKeys(memberPublicKeys);

      // upload new state for all active members
      data = [];
      await Promise.all(activeMembers.map(async (member: Membership) => {
        const memberService = new MembershipService(this.wallet, this.api);
        memberService.setVaultId(this.vaultId);
        memberService.setObjectId(member.id);
        memberService.setObject(member);
        const dataTx = await memberService.mergeAndUploadState({ keys: memberKeys.get(member.id) });
        data.push({ id: member.id, value: dataTx });
      }));
    }

    const { id, object } = await this.api.postContractTransaction<Membership>(
      this.vaultId,
      { function: this.function, data },
      this.arweaveTags
    );
    const membership = await this.processMembership(object, !this.isPublic, this.keys);
    return { transactionId: id, object: membership };
  }

  /**
   * @param  {string} membershipId
   * @param  {RoleType} role VIEWER/CONTRIBUTOR/OWNER
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
   * @param  {MembershipCreateOptions} [options] invitation email message, etc.
   * @returns Promise with new membership id & corresponding transaction id
   */
  public async inviteNewUser(vaultId: string, email: string, role: RoleType, options: MembershipCreateOptions = {}): Promise<{
    membershipId: string
  }> {
    const { id } = await this.api.inviteNewUser(vaultId, email, role, options.message);
    return { membershipId: id };
  }

  /**
 * Revoke invite for user without an Akord account
 * @param  {string} vaultId
 * @param  {string} membershipId
 */
  public async revokeInvite(vaultId: string, membershipId: string): Promise<void> {
    await this.api.revokeInvite(vaultId, membershipId);
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

  async profileUpdate(membershipId: string, name: string, avatar: ArrayBuffer): Promise<MembershipUpdateResult> {
    await this.setVaultContextFromMembershipId(membershipId);
    const memberDetails = await this.processMemberDetails({ name, avatar }, this.object.__cacheOnly__);
    this.setActionRef(actionRefs.MEMBERSHIP_PROFILE_UPDATE);
    this.setFunction(functions.MEMBERSHIP_UPDATE);

    const data = await this.mergeAndUploadState({ memberDetails });
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
    this.setVaultId(membership.vaultId);
    this.setIsPublic(membership.__public__);
    await this.setMembershipKeys(membership);
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

  private async prepareMemberKeys(publicKey: string): Promise<EncryptedKeys[]> {
    if (!this.isPublic) {
      const keysEncrypter = new Encrypter(this.wallet, this.dataEncrypter.keys, base64ToArray(publicKey));
      try {
        const keys = await keysEncrypter.encryptMemberKeys([]);
        return keys.map((keyPair: EncryptedKeys) => {
          delete keyPair.publicKey;
          return keyPair;
        });
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    } else {
      return null;
    }
  }
};

export type MembershipCreateOptions = {
  message?: string
}

type MembershipCreateResult = {
  membershipId: string,
  transactionId: string,
  object: Membership
}

type MembershipUpdateResult = {
  transactionId: string,
  object: Membership
}

export {
  MembershipService
}
