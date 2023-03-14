import { Akord } from "../index";
import { email, password } from './data/test-credentials';
import { vaults, fileId, message, publicVaultId, privateVaultId, parentId } from './data/content';
import { NodeJs } from "../types/file";

let privateClient: Akord;
let publicClient: Akord;

jest.setTimeout(3000000);

describe("Testing querying directly from permaweb", () => {
  beforeAll(async () => {
    const { jwtToken, wallet } = await Akord.auth.signIn(email, password);
    privateClient = new Akord(wallet, jwtToken);
    publicClient = new Akord();
  });

  // it("Query all vaults from Akord API", async () => {
  //   const result = await privateClient.vault.list();
  //   expect(result).toEqual(vaults);
  // });

  it("Should query public vault - contract state from Akord API", async () => {
    const contract = await publicClient.contract.getState(publicVaultId);
    expect(contract.name).not.toBeNull();
    expect(contract.public).toBeTruthy();
    expect(contract.folders.length).toBeTruthy();
    expect(contract.stacks.length).toBeTruthy();
  });

  it("Query stacks", async () => {
    const stacks = await publicClient.stack.listAll(publicVaultId);
    expect(stacks.length).toEqual(6);
  });

  it("Query stacks by parent id", async () => {
    const stacks = await publicClient.stack.listAll(publicVaultId, parentId);
    expect(stacks.length).toEqual(2);
    expect(stacks[0].parentId).toEqual(parentId);
    expect(stacks[1].parentId).toEqual(parentId);
  });

  // it("Query chunked file from Akord API", async () => {
  //   const decryptedFile = await privateClient.file.get(fileId, vaults[0].id, { isChunked: true, numberOfChunks: 3 });
  //   const file = NodeJs.File.fromPath("./src/__tests__/data/chunked-file.test");
  //   expect(Buffer.from(decryptedFile)).toEqual(await file.arrayBuffer());
  // });

  // it("Query chunked file from Akord API", async () => {
  //   const decryptedFile = await privateClient.file.get(fileId, vaults[0].id, { isChunked: true, numberOfChunks: 3 });
  //   const file = NodeJs.File.fromPath("./src/__tests__/data/chunked-file.test");
  //   expect(Buffer.from(decryptedFile)).toEqual(await file.arrayBuffer());
  // });
});
