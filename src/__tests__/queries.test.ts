import Akord from "../akord";
import { AkordWallet } from "@akord/crypto";
import ApiAuthenticator from "../api/akord/api-authenticator";
import fs from "fs";
import path from "path";
import { email, password } from './data/test-credentials';
import { vaults, fileId, message } from './data/content';

let akord1: Akord;
let akord2: Akord;

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
    akord1 = new Akord(wallet, jwtToken, { wallet: <any>"Akord" });
    akord2 = new Akord(wallet, undefined, { wallet: <any>"Arweave" });
  });

  it("Query all vaults from Akord API", async () => {
    const result = await akord1.getVaults();
    expect(result).toEqual(vaults);
  });

  it("Query all vaults from Arweave API", async () => {
    const result = await akord2.getVaults();
    expect(result).toEqual(vaults);
  });

  it("Query memos from Arweave API", async () => {
    const result = await akord2.getNodes(vaults[0].id, 'Memo');
    expect(result.length).toEqual(1);
    expect(result[0].message).toEqual(message);
  });

  it("Query chunked file from Akord API", async () => {
    const decryptedFile = await akord1.getFile(fileId, vaults[0].id, true, 3);
    const file = getFileFromPath("./src/__tests__/data/chunked-file.test");
    expect(Buffer.from(decryptedFile)).toEqual(file.data);
  });
});