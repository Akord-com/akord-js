import { Akord } from "../index";
import { AkordWallet } from "@akord/crypto";
import ApiAuthenticator from "../api/akord/api-authenticator";
import fs from "fs";
import path from "path";
import { email, password } from './data/test-credentials';
import { vaults, fileId, message, publicVaultId } from './data/content';

let clientWithAkordWallet: Akord;
let clientWithArweaveWallet: Akord;
let clientWithoutWallet: Akord;

jest.setTimeout(3000000);

function getFileFromPath(filePath: string) {
  let file = <any>{};
  if (!fs.existsSync(filePath)) {
    console.error("Could not find a file in your filesystem: " + filePath);
    process.exit(0);
  }
  const stats = fs.statSync(filePath);
  file.size = stats.size;
  file.data = fs.readFileSync(filePath);
  file.name = path.basename(filePath);
  return file;
}


describe("Testing querying directly from permaweb", () => {
  beforeAll(async () => {
    const apiAuthenticator = new ApiAuthenticator();
    const jwtToken = await apiAuthenticator.getJWTToken(email, password);
    const userAttributes = await apiAuthenticator.getUserAttributes(email, password);
    const wallet = await AkordWallet.importFromEncBackupPhrase(password, userAttributes["custom:encBackupPhrase"]);
    clientWithAkordWallet = new Akord(wallet, jwtToken, { wallet: <any>"Akord" });
    clientWithArweaveWallet = new Akord(wallet, undefined, { wallet: <any>"Arweave" });
    clientWithoutWallet = new Akord(undefined, undefined, { wallet: <any>"Akord" });

  });

  it("Query all vaults from Akord API", async () => {
    const result = await clientWithAkordWallet.getVaults();
    expect(result).toEqual(vaults);
  });


  it("Should query public vault - contract state from Akord API", async () => {
    const result = await clientWithoutWallet.getContractState(publicVaultId);
    expect(result.state.name).not.toBeNull();
    expect(result.state.isPublic).toBeTruthy();
    expect(result.state.folders.length).toBeTruthy();
    expect(result.state.stacks.length).toBeTruthy();
    expect(result.state.notes.length).toBeTruthy();
  });

  it("Query all vaults from Arweave API", async () => {
    const result = await clientWithArweaveWallet.getVaults();
    expect(result).toEqual(vaults);
  });

  it("Query memos from Arweave API", async () => {
    const result = await clientWithArweaveWallet.getNodes(vaults[0].id, 'Memo');
    expect(result.length).toEqual(1);
    expect(result[0].message).toEqual(message);
  });

  it("Query chunked file from Akord API", async () => {
    const decryptedFile = await clientWithAkordWallet.getFile(fileId, vaults[0].id, true, 3);
    const file = getFileFromPath("./src/__tests__/data/chunked-file.test");
    expect(Buffer.from(decryptedFile)).toEqual(file.data);
  });

  it("Query chunked file from Akord API", async () => {
    const decryptedFile = await clientWithAkordWallet.getFile(fileId, vaults[0].id, true, 3);
    const file = getFileFromPath("./src/__tests__/data/chunked-file.test");
    expect(Buffer.from(decryptedFile)).toEqual(file.data);
  });
});
