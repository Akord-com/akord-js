import { MembershipService } from "./membership";
import { actionRefs } from "../constants";
import { EncryptionType } from "@akord/crypto";
import { ProfileDetails } from "../types/profile-details";
import { InMemoryStorageStrategy, PCacheable, PCacheBuster } from "@akord/ts-cacheable";
import { CacheBusters } from "../types/cacheable";
import { Service } from "./service";

class ProfileService extends Service {
  objectType: string = "Profile";

  /**
   * Fetch currently authenticated user's profile details
   * @returns Promise with profile details
   */
  @PCacheable({
    storageStrategy: InMemoryStorageStrategy,
    cacheBusterObserver: CacheBusters.profile,
    shouldCacheDecider: () => CacheBusters.cache
  })
  public async get(): Promise<ProfileDetails> {
    return await this.getProfileDetails();
  }

  /**
   * Update user profile along with all active memberships
   * @param  {string} name new profile name
   * @param  {any} avatar new avatar buffer
   * @returns Promise with corresponding transaction ids
   */
  @PCacheBuster({
    cacheBusterNotifier: CacheBusters.profile
  })
  public async update(name: string, avatar: any): Promise<{ transactionId: string }[]> {
    let transactions = [];

    const profilePromise = new Promise<void>(async (resolve, reject) => {
      this.setActionRef(actionRefs.PROFILE_UPDATE);
      const profile = await this.api.getProfile(this.wallet);
      this.setObject(profile);

      this.setRawDataEncryptionPublicKey(await this.wallet.publicKeyRaw());
      this.setIsPublic(false);
      const profileDetails = await this.processMemberDetails({ fullName: name, avatar }, false);

      // merge & upload current profile state to Arweave
      const currentProfileDetails = profile.state.profileDetails;
      const mergedProfileDetails = {
        fullName: profileDetails.fullName || currentProfileDetails.fullName,
        avatarTx: profileDetails.avatarTx || currentProfileDetails.avatarTx,
      }

      const ids = await this.api.uploadData([{ body: { profileDetails: mergedProfileDetails }, tags: {} }], false);

      const header = {
        schemaUri: 'akord:profile:write',
        stateRef: ids[0].resourceId,
        ...await this.prepareHeader()
      }
      const encodedTransaction = await this.encodeTransaction(header, { profileDetails, encryptionType: EncryptionType.KEYS_STRUCTURE });
      const { id } = await this.api.postLedgerTransaction([encodedTransaction]);
      transactions.push(id);
      resolve();
    })

    const memberships = await this.api.getMemberships(this.wallet);
    const membershipPromiseArray = memberships.map(async (membership) => {
      const membershipService = new MembershipService(this.wallet, this.api);
      const { transactionId } = await membershipService.profileUpdate(membership.id, name, avatar);
      transactions.push(transactionId);
    })
    await Promise.all(membershipPromiseArray.concat([profilePromise]));
    return transactions;
  }
};

export {
  ProfileService
}
