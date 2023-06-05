import { MembershipService } from "./membership";
import { ProfileDetails } from "../types/profile-details";
import { InMemoryStorageStrategy, PCacheable, PCacheBuster } from "@akord/ts-cacheable";
import { CacheBusters } from "../types/cacheable";
import { Service } from "./service";
import { objectType } from "../constants";
import { Membership } from "../types/membership";
import { ListOptions } from "../types/query-options";

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
  public async update(name: string, avatar: ArrayBuffer): Promise<{
    transactions: { id: string, transactionId: string }[],
    errors: { id: string, error: any }[]
  }> {
    // update profile
    const user = await this.api.getUser();
    this.setObject(<any>user);

    this.setRawDataEncryptionPublicKey(this.wallet.publicKeyRaw());
    this.setIsPublic(false);
    const profileDetails = await this.processMemberDetails({ name, avatar }, true);

    const newProfileDetails = new ProfileDetails({
      ...user,
      ...profileDetails,
    });
    await this.api.updateUser(newProfileDetails.name, newProfileDetails.avatarUri);

    // update user memberships
    let transactions = [];

    const memberships = await this.listMemberships();

    const membershipPromises = memberships.map(async (membership) => {
      const membershipService = new MembershipService(this.wallet, this.api);
      const { transactionId } = await membershipService.profileUpdate(membership.id, name, avatar);
      transactions.push({ id: membership.id, transactionId: transactionId });
      return membership;
    })
    const { errors } = await this.handleListErrors(memberships, membershipPromises);
    return { transactions, errors };
  }

  private async listMemberships(): Promise<Array<Membership>> {
    const list = async (listOptions: ListOptions) => {
      return await this.api.getMemberships(listOptions);
    }
    return await this.paginate<Membership>(list, {});
  }
};

export {
  ProfileService
}
