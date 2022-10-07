import { AkordWallet } from "@akord/crypto";
import { Akord } from "../../akord";
import { AkordApi } from "../../api";
import { CacheConfig } from "../../model/cacheable";
import { Service } from "../../service";

let akord: Akord;


beforeEach(async () => {
    CacheConfig.profileBuster.next("clear-cache")
});

it("should query the profile with cache disabled", async () => {
    Service.prototype.getProfileDetails = jest.fn().mockImplementation(() => {
        return {
            publicSigningKey: "test",
            email: "any@akord.com"
        };
    });

    akord = new Akord(
        undefined,
        undefined,
        {
            cache: false
        }
    );

    const profile1 = await akord.profile.get();
    const profile2 = await akord.profile.get();

    expect(Service.prototype.getProfileDetails).toHaveBeenCalledTimes(2);
    expect(profile2).toEqual(profile1);
});

it("should query the profile with cache disabled by default", async () => {
    Service.prototype.getProfileDetails = jest.fn().mockImplementation(() => {
        return {
            publicSigningKey: "test",
            email: "any@akord.com"
        };
    });

    akord = new Akord(undefined, undefined, {});

    const profile1 = await akord.profile.get();
    const profile2 = await akord.profile.get();

    expect(Service.prototype.getProfileDetails).toHaveBeenCalledTimes(2);
    expect(profile2).toEqual(profile1);
});

it("should query the profile and cache the result", async () => {
    Service.prototype.getProfileDetails = jest.fn().mockImplementation(() => {
        return {
            publicSigningKey: "test",
            email: "any@akord.com"
        };
    });

    akord = new Akord(undefined, undefined,
        {
            cache: true
        });

    const profile = await akord.profile.get();
    const cachedProfile = await akord.profile.get();

    expect(Service.prototype.getProfileDetails).toHaveBeenCalledTimes(1);
    expect(cachedProfile).toEqual(profile);
});

it("should bust the profile cache on profile update", async () => {
    Service.prototype.getProfileDetails = jest.fn().mockImplementation(() => {
        return {
            publicSigningKey: "test",
            email: "any@akord.com"
        };
    });

    Service.prototype.encodeTransaction = jest.fn().mockImplementation(() => {
        return "";
    });

    AkordApi.prototype.getProfileByPublicSigningKey = jest.fn().mockImplementation(() => {
        return {
            state: {
                profileDetails: {
                    fullName: "any"
                }
            }
        };
    });

    AkordApi.prototype.uploadData = jest.fn().mockImplementation(() => {
        return [{
            resourceId: "any"
        }];
    });

    AkordApi.prototype.postLedgerTransaction = jest.fn().mockImplementation(() => {
        return {};
    });

    AkordApi.prototype.getMemberships = jest.fn().mockImplementation(() => {
        return [];
    });

    const wallet = new AkordWallet("any");
    akord = new Akord(wallet, undefined,
        {
            cache: true
        });

    await akord.profile.get();
    await akord.profile.get();

    expect(Service.prototype.getProfileDetails).toHaveBeenCalledTimes(1);

    await akord.profile.update("", "");
    await akord.profile.get();

    expect(Service.prototype.getProfileDetails).toHaveBeenCalledTimes(2);
});
