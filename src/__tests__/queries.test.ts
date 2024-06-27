import { Akord, Auth } from "../index";
import { email, password } from './data/test-credentials';
import { vaults, fileId, publicVaultId,  parentId } from './data/content';

let privateClient: Akord;
let publicClient: Akord;

jest.setTimeout(3000000);

describe("Testing querying directly from permaweb", () => {
  beforeAll(async () => {
    Auth.configure({ env: process.env.ENV as any });
    const { wallet } = await Auth.signIn(email, password);
    privateClient = new Akord(wallet, { debug: true, env: process.env.ENV as any, logToFile: true });
    publicClient = new Akord(undefined, { debug: true, env: process.env.ENV as any, logToFile: true });
  });

  it("Query all vaults from Akord API", async () => {
    const result = await privateClient.vault.listAll();
    expect(result).toBeTruthy();
  });

  // it("Should query public vault - contract state from Akord API", async () => {
  //   const contract = await publicClient.contract.getState(publicVaultId);
  //   expect(contract.name).not.toBeNull();
  //   expect(contract.public).toBeTruthy();
  //   expect(contract.folders.length).toBeTruthy();
  //   expect(contract.stacks.length).toBeTruthy();
  // });

  it("Should query public vault - contract state from Akord API", async () => {
    const vault = await publicClient.vault.get(publicVaultId, { deep: true });
    expect(vault.name).not.toBeNull();
    expect(vault.public).toBeTruthy();
    expect(vault.folders?.length).toBeTruthy();
    expect(vault.stacks?.length).toBeTruthy();
  });

  it("Query stacks", async () => {
    const stacks = await publicClient.stack.listAll(publicVaultId);
    expect(stacks.length).toEqual(6);
  });

  it("Query stacks by parent id", async () => {
    const stacks = await publicClient.stack.listAll(publicVaultId, { parentId });
    expect(stacks.length).toEqual(1);
    expect(stacks[0].parentId).toEqual(parentId);
  });

  // it("Query chunked file from Akord API", async () => {
  //   const decryptedFile = await privateClient.file.get(fileId, vaults[0].id, { isChunked: true, numberOfChunks: 3 });
  //   const file = await NodeJs.File.fromPath("./src/__tests__/data/chunked-file.test");
  //   expect(Buffer.from(decryptedFile)).toEqual(await file.arrayBuffer());
  // });

  // it("Query chunked file from Akord API", async () => {
  //   const decryptedFile = await privateClient.file.get(fileId, vaults[0].id, { isChunked: true, numberOfChunks: 3 });
  //   const file = await NodeJs.File.fromPath("./src/__tests__/data/chunked-file.test");
  //   expect(Buffer.from(decryptedFile)).toEqual(await file.arrayBuffer());
  // });
});
