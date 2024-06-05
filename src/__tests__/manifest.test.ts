import { Akord } from "../index";
import { cleanup, initInstance } from './common';
import faker from '@faker-js/faker';
import { BadRequest } from "../errors/bad-request";

let akord: Akord;

jest.setTimeout(3000000);

const manifest = {
  "manifest": "arweave/paths",
  "version": "0.1.0",
  "index": {
    "path": "index.html"
  },
  "paths": {
    "index.html": {
      "id": "cG7Hdi_iTQPoEYgQJFqJ8NMpN4KoZ-vH_j7pG4iP7NI"
    },
    "js/app.js": {
      "id": "fZ4d7bkCAUiXSfo3zFsPiQvpLVKVtXUKB6kiLNt2XVQ"
    },
    "css/style.css": {
      "id": "fZ4d7bkCAUiXSfo3zFsPiQvpLVKVtXUKB6kiLNt2XVQ"
    },
    "css/mobile.css": {
      "id": "fZ4d7bkCAUiXSfo3zFsPiQvpLVKVtXUKB6kiLNt2XVQ"
    },
    "assets/img/logo.png": {
      "id": "QYWh-QsozsYu2wor0ZygI5Zoa_fRYFc8_X1RkYmw_fU"
    },
    "assets/img/icon.png": {
      "id": "0543SMRGYuGKTaqLzmpOyK4AxAB96Fra2guHzYxjRGo"
    }
  }
};

describe("Testing manifest functions", () => {
  let vaultId: string;

  beforeEach(async () => {
    akord = await initInstance();
  });

  beforeAll(async () => {
    akord = await initInstance();
    vaultId = (await akord.vault.create(faker.random.words(), {
      cloud: true,
      public: true
    })).vaultId;
  });

  afterAll(async () => {
    await cleanup(akord, vaultId);
  });

  it("should upload new file to the vault", async () => {
    // upload html file
    const { stackId } = await akord.stack.create(
      vaultId,
      ["<html><body><h1>Hello World</h1></body></html>"],
      { name: "index.html", mimeType: "text/html" }
    );
    console.log("uploaded index.html", stackId);
  });

  it("should create new manifest", async () => {
    const { transactionId, uri } = await akord.manifest.generate(vaultId);
    expect(transactionId).not.toBeFalsy();
    expect(uri).not.toBeFalsy();
    console.log("manifest uri: " + uri);
    const manifestJSON = await akord.manifest.getVersion(vaultId);
    expect(manifestJSON).not.toBeFalsy();
  });

  it("should generate new version for the manifest", async () => {
    const { transactionId, uri } = await akord.manifest.generate(vaultId);
    expect(transactionId).not.toBeFalsy();
    expect(uri).not.toBeFalsy();
    console.log("manifest uri: " + uri);
    const manifestJSON = await akord.manifest.getVersion(vaultId);
    expect(manifestJSON).not.toBeFalsy();
  });

  it("should fail creating manifest for private vault", async () => {
    await expect(async () => {
      const privateVaultId = (await akord.vault.create(faker.random.words(), {
        cloud: true,
        public: false
      })).vaultId;
      await akord.manifest.generate(privateVaultId);
    }).rejects.toThrow(BadRequest);
  });

});