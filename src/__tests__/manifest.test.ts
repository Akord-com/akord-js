import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
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

async function vaultCreate() {
  const name = faker.random.words();
  const termsOfAccess = faker.lorem.sentences();
  const { vaultId, membershipId } = await akord.vault.create(name, termsOfAccess, true);
  console.log("created vault", name);

  const membership = await akord.membership.get(membershipId);
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.role).toEqual("OWNER");

  const htmlSrc = "<html><body><h1>Hello World</h2></body></html>";
  const htmlFile = await createFileLike([htmlSrc], "index.html", "text/html");
  const { stackId } = await akord.stack.create(vaultId, htmlFile, "index.html");
  console.log("uploaded index.html", stackId);

  const vault = await akord.vault.get(vaultId);
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.name).toEqual(name);

  console.log(vaultId, name);

  return { vaultId };
}

describe("Testing manifest functions", () => {
  let vaultId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  it("should create new manifest", async () => {
    const { transactionId } = await akord.manifest.generate(vaultId);
    expect(transactionId).not.toBeFalsy();
    console.log("manifest tx id", vaultId);
    const manifestJSON = await akord.manifest.getVersion(vaultId);
    // expect(manifest).toEqual(manifestJSON);
    expect(manifestJSON).not.toBeFalsy();
  });
});