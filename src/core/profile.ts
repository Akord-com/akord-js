import { MembershipService } from "./membership";
import { ProfileDetails } from "../types/profile-details";
import { InMemoryStorageStrategy, PCacheable, PCacheBuster } from "@akord/ts-cacheable";
import { CacheBusters } from "../types/cacheable";
import { Service } from "./service";
import { objectType } from "../constants";
import { Membership } from "../types/membership";

class ProfileService extends Service {
  objectType = objectType.PROFILE;

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
  public async update(name: string, avatar: ArrayBuffer): Promise<{ transactionId: string }[]> {
    let transactions = [];

    const profilePromise = new Promise<void>(async (resolve, reject) => {
      const user = await this.api.getUser();
      this.setObject(<any>user);

      this.setRawDataEncryptionPublicKey(this.wallet.publicKeyRaw());
      this.setIsPublic(false);
      const profileDetails = await this.processMemberDetails({ name, avatar }, false);

      const newProfileDetails = new ProfileDetails({
        ...user,
        ...profileDetails,
      });
      await this.api.uploadData([{ data: { profileDetails: newProfileDetails }, tags: [] }], false);
      await this.api.updateUser(newProfileDetails.name, newProfileDetails.avatarUri);
      resolve();
    })

    let token = undefined;
    let memberships = [] as Membership[];
    do {
      const { items, nextToken } = await this.api.getMemberships(100, token);
      memberships = memberships.concat(items);
      token = nextToken;
      if (nextToken === "null") {
        token = undefined;
      }
    } while (token);
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
