import { MembershipService } from "./membership";
import { ProfileDetails } from "../types/profile-details";
import { InMemoryStorageStrategy, PCacheable, PCacheBuster } from "@akord/ts-cacheable";
import { CacheBusters } from "../types/cacheable";
import { Service } from "./service";
import { objectType } from "../constants";
import { Membership } from "../types/membership";
import { ListOptions } from "../types/query-options";
import { getEncryptedPayload, handleListErrors, paginate } from "./common";
import { Encrypter, arrayToString } from "@akord/crypto";
import { IncorrectEncryptionKey } from "../errors/incorrect-encryption-key";

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
    const user = await this.api.getUser();
    if (user) {
      const profileEncrypter = new Encrypter(this.wallet, null, null);
      profileEncrypter.decryptedKeys = [
        {
          publicKey: this.wallet.publicKeyRaw(),
          privateKey: this.wallet.privateKeyRaw()
        }
      ]
      let avatar = null;
      const resourceUri = getAvatarUri(new ProfileDetails(user));
      if (resourceUri) {
        const { fileData, metadata } = await this.api.downloadFile(resourceUri);
        const encryptedPayload = getEncryptedPayload(fileData, metadata);
        try {
          if (encryptedPayload) {
            avatar = await profileEncrypter.decryptRaw(encryptedPayload, false);
          } else {
            const dataString = arrayToString(new Uint8Array(fileData));
            avatar = await profileEncrypter.decryptRaw(dataString, true);
          }
        } catch (error) {
          throw new IncorrectEncryptionKey(error);
        }
      }
      try {
        const decryptedProfile = await profileEncrypter.decryptObject(
          user,
          ['name'],
        );
        return { ...decryptedProfile, avatar }
      } catch (error) {
        throw new IncorrectEncryptionKey(error);
      }
    }
    return <any>{};
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
    errors: { id: string, error: Error }[]
  }> {
    // update profile
    const user = await this.api.getUser();

    const service = new MembershipService(this.wallet, this.api);

    service.setRawDataEncryptionPublicKey(this.wallet.publicKeyRaw());
    service.setIsPublic(false);
    const profileDetails = await service.processMemberDetails({ name, avatar }, true);

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
    const { errors } = await handleListErrors(memberships, membershipPromises);
    return { transactions, errors };
  }

  private async listMemberships(): Promise<Array<Membership>> {
    const list = async (listOptions: ListOptions) => {
      return await this.api.getMemberships(listOptions);
    }
    return await paginate<Membership>(list, {});
  }
};

const getAvatarUri = (profileDetails: ProfileDetails) => {
  if (profileDetails.avatarUri && profileDetails.avatarUri.length) {
    const avatarUri = [...profileDetails.avatarUri]
      .reverse()
      .find(resourceUri => resourceUri.startsWith("s3:"))
      ?.replace("s3:", "");
    return avatarUri !== "null" && avatarUri;
  } else {
    return null;
  }
}

export {
  ProfileService
}
