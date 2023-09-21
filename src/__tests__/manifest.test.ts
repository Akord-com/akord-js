import { Akord } from "../index";
import { initInstance, vaultCreate } from './common';
import { email, password } from './data/test-credentials';
import { createFileLike } from "../core/file";

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
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate(akord, false)).vaultId;

    // upload html file
    const htmlSrc = "<html><body><h1>Hello World</h1></body></html>";
    const htmlFile = await createFileLike([htmlSrc], "index.html", "text/html");
    const { stackId } = await akord.stack.create(vaultId, htmlFile, "index.html");
    console.log("uploaded index.html", stackId);
  });

  // it("should create new manifest", async () => {
  //   const { transactionId } = await akord.manifest.generate("bdTOvS3SwNyMOa9rsvjJyQ1bkuU-eCugsHvtEtP8YGU");
  //   expect(transactionId).not.toBeFalsy();
  //   const manifest = await akord.manifest.get("bdTOvS3SwNyMOa9rsvjJyQ1bkuU-eCugsHvtEtP8YGU");
  //   const manifestTxId = manifest.getUri();
  //   console.log("manifest url: http://arweave.net/" + manifestTxId);
  // });

  it("should create new manifest", async () => {
    const { transactionId } = await akord.manifest.generate(vaultId);
    expect(transactionId).not.toBeFalsy();
    const manifest = await akord.manifest.get(vaultId);
    const manifestTxId = manifest.getUri();
    console.log("manifest tx id: " + manifestTxId);
    const manifestJSON = await akord.manifest.getVersion(vaultId);
    expect(manifestJSON).not.toBeFalsy();
  });
});