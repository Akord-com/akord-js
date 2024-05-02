import { AkordWallet, generateKeyPair } from "@akord/crypto";
import { Akord } from "../akord";
import { AkordApi } from "../api/akord-api";
import { CacheConfig } from "../types/cacheable";
import { NodeService } from "../core/node";
import { testDataPath } from "./common";
import { firstFileName } from "./data/content";
import { FileService } from "../core/file";

let akord: Akord;

describe("Cache profile", () => {
    beforeEach(async () => {
        CacheConfig.profileBuster.next("clear-cache")
    });

    it("should query the user with cache disabled", async () => {
        AkordApi.prototype.getUser = jest.fn().mockImplementation(() => {
            return {
                name: "any"
            }
        });

        akord = new Akord(
            undefined,
            {
                cache: false
            }
        );

        const profile1 = await akord.profile.get();
        const profile2 = await akord.profile.get();

        expect(AkordApi.prototype.getUser).toHaveBeenCalledTimes(2);
        expect(profile2).toEqual(profile1);
    });

    it("should query the user with cache disabled by default", async () => {
        AkordApi.prototype.getUser = jest.fn().mockImplementation(() => {
            return {
                name: "any"
            }
        });

        akord = new Akord(undefined, {});

        const profile1 = await akord.profile.get();
        const profile2 = await akord.profile.get();

        expect(AkordApi.prototype.getUser).toHaveBeenCalledTimes(2);
        expect(profile2).toEqual(profile1);
    });

    it("should query the profile and cache the result", async () => {
        AkordApi.prototype.getUser = jest.fn().mockImplementation(() => {
            return {
                name: "any"
            }
        });

        akord = new Akord(undefined,
            {
                cache: true
            });

        const profile = await akord.profile.get();
        const cachedProfile = await akord.profile.get();

        expect(AkordApi.prototype.getUser).toHaveBeenCalledTimes(1);
        expect(cachedProfile).toEqual(profile);
    });

    it("should bust the profile cache on profile update", async () => {
        AkordApi.prototype.getUser = jest.fn().mockImplementation(() => {
            return {
                name: "any"
            }
        });

        AkordApi.prototype.uploadFile = jest.fn().mockImplementation(() => {
            return [{
                resourceId: "any"
            }];
        });

        AkordApi.prototype.updateUser = jest.fn().mockImplementation(() => {
            return;
        });

        const wallet = new AkordWallet("any");

        const keyPair = await generateKeyPair();
        wallet.signingPrivateKeyRaw = jest.fn().mockImplementation(() => {
            return keyPair.privateKey;
        });

        akord = new Akord(wallet,
            {
                cache: true
            });



        await akord.profile.get();
        await akord.profile.get();

        expect(AkordApi.prototype.getUser).toHaveBeenCalledTimes(1);

        await akord.profile.update("");
        await akord.profile.get();

        expect(AkordApi.prototype.getUser).toHaveBeenCalledTimes(3); //+1 internal call
    });
});

describe("Cache vault context", () => {
    beforeEach(async () => {
        CacheConfig.profileBuster.next("clear-cache")
    });

    it("should query the vault context 2 times when creating 2 new stacks with cache disabled", async () => {
        AkordApi.prototype.getVault = jest.fn().mockImplementation(() => {
            return {
                name: "any",
                public: true
            }
        });

        NodeService.prototype.nodeCreate = jest.fn().mockImplementation(() => {
            return { nodeId: "any", transactionId: "any", object: {} }
        });

        FileService.prototype.create = jest.fn().mockImplementation(() => {
            return { resourceUri: ["test"] }
        });

        const wallet = new AkordWallet("any");

        const keyPair = await generateKeyPair();
        wallet.signingPrivateKeyRaw = jest.fn().mockImplementation(() => {
            return keyPair.privateKey;
        });
        wallet.getAddress = jest.fn().mockImplementation(() => {
            return "some_address";
        });

        akord = new Akord(
            wallet,
            {
                cache: false
            }
        );

        await akord.stack.create("some_vault_id", testDataPath + firstFileName);
        await akord.stack.create("some_vault_id", testDataPath + firstFileName);

        expect(AkordApi.prototype.getVault).toHaveBeenCalledTimes(2);
    });

    it("should query the vault context 1 time when creating multiple stacks with cache enabled", async () => {
        AkordApi.prototype.getVault = jest.fn().mockImplementation(() => {
            return {
                name: "any",
                public: true
            }
        });

        NodeService.prototype.nodeCreate = jest.fn().mockImplementation(() => {
            return { nodeId: "any", transactionId: "any", object: {} }
        });

        FileService.prototype.create = jest.fn().mockImplementation(() => {
            return { resourceUri: ["test"] }
        });

        const wallet = new AkordWallet("any");

        const keyPair = await generateKeyPair();
        wallet.signingPrivateKeyRaw = jest.fn().mockImplementation(() => {
            return keyPair.privateKey;
        });
        wallet.getAddress = jest.fn().mockImplementation(() => {
            return "some_address";
        });

        akord = new Akord(
            wallet,
            {
                cache: true
            }
        );

        await akord.stack.create("some_vault_id", testDataPath + firstFileName);
        await akord.stack.create("some_vault_id", testDataPath + firstFileName);
        await akord.stack.create("some_vault_id", testDataPath + firstFileName);

        expect(AkordApi.prototype.getVault).toHaveBeenCalledTimes(1);
    });
});

