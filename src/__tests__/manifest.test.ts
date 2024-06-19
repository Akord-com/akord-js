import { Akord } from "../index";
import { cleanup, initInstance, testDataPath } from './common';
import faker from '@faker-js/faker';
import { BadRequest } from "../errors/bad-request";
import fs from "fs";
import path from "path";

async function uploadFolder(folderPath: string, akord: Akord, vaultId: string, parentId?: string) {
  const files = fs.readdirSync(folderPath);
  for (let file of files) {
    const fullPath = path.join(folderPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const { folderId } = await akord.folder.create(vaultId, file, { parentId: parentId });
      console.log("created folder: " + file);
      // recursively process the subdirectory
      await uploadFolder(fullPath, akord, vaultId, folderId);
    } else {
      // upload file
      await akord.stack.create(vaultId, fullPath, { parentId: parentId });
      console.log("uploaded file: " + fullPath + " to folder: " + parentId);
    }
  }
}

let akord: Akord;

jest.setTimeout(3000000);

const manifestSample = {
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
    "assets/img/favicon.png": {
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
    console.log("vault id: " + vaultId);
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


  it("should sync simple app with the vault", async () => {
    const { vaultId } = await akord.vault.create(faker.random.words(), {
      cloud: true,
      public: true
    });
    console.log("vault id: " + vaultId);

    // upload app files
    const appDirName = "simple-app"
    await uploadFolder(testDataPath + appDirName, akord, vaultId);

    const { transactionId, uri } = await akord.manifest.generate(vaultId);
    expect(transactionId).not.toBeFalsy();
    expect(uri).not.toBeFalsy();
    console.log("manifest uri: " + uri);
    const manifest = await akord.manifest.get(vaultId);
    expect(manifest.vaultId).toEqual(vaultId);
    expect(manifest.versions.length).toEqual(1);
    const manifestJSON = await akord.manifest.getVersion(vaultId) as any;
    expect(manifestJSON).not.toBeFalsy();
    expect(manifestJSON.paths).not.toBeFalsy();
    expect(Object.keys(manifestJSON.paths).length).toEqual(Object.keys(manifestSample.paths).length);
    expect(Object.keys(manifestJSON.paths)).toEqual(expect.arrayContaining(Object.keys(manifestSample.paths)));
    expect(Object.keys(manifestSample.paths)).toEqual(expect.arrayContaining(Object.keys(manifestJSON.paths)));
  });

  it("should create a new manifest for the folder", async () => {
    const { folderId } = await akord.folder.create(vaultId, "My simple app folder");

    // upload app files
    const appDirName = "simple-app"
    await uploadFolder(testDataPath + appDirName, akord, vaultId, folderId);

    const { transactionId, uri } = await akord.manifest.generate(vaultId, { parentId: folderId });
    expect(transactionId).not.toBeFalsy();
    expect(uri).not.toBeFalsy();
    console.log("manifest uri: " + uri);
    const manifest = await akord.manifest.get(vaultId, folderId);
    expect(manifest.vaultId).toEqual(vaultId);
    expect(manifest.parentId).toEqual(folderId);
    expect(manifest.versions.length).toEqual(1);
    const manifestJSON = await akord.manifest.getVersion(vaultId, folderId) as any;
    console.log(manifestJSON)
    expect(manifestJSON).not.toBeFalsy();
    expect(manifestJSON.paths).not.toBeFalsy();
    expect(Object.keys(manifestJSON.paths).length).toEqual(Object.keys(manifestSample.paths).length);
    expect(Object.keys(manifestJSON.paths)).toEqual(expect.arrayContaining(Object.keys(manifestSample.paths)));
    expect(Object.keys(manifestSample.paths)).toEqual(expect.arrayContaining(Object.keys(manifestJSON.paths)));
  });
});