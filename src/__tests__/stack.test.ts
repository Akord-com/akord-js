import Akord from "../akord";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import fs from "fs";
import path from "path";
import { email, password } from './data/test-credentials';

let akord: Akord;

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

async function vaultCreate() {
  const name = faker.random.words();
  const termsOfAccess = faker.lorem.sentences();
  const { vaultId, membershipId } = await akord.vault.create(name, termsOfAccess);

  const membership = await akord.api.getObject(membershipId, "Membership");
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.state.role).toEqual("OWNER");

  const vault = await akord.decryptObject(vaultId, "Vault");
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.state.title).toEqual(name);
  return { vaultId };
}

describe("Testing stack commands", () => {
  let vaultId: string;
  let stackId: string;

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  it("should create new stack", async () => {
    const name = faker.random.words();

    const file = getFileFromPath("./src/__tests__/data/logo.png");
    file.type = "image/png";

    stackId = (await akord.stack.create(vaultId, file, name)).stackId;

    const stack = await akord.decryptObject(stackId, "Stack");
    expect(stack.status).toEqual("ACTIVE");
    expect(stack.state.title).toEqual(name);
    expect(stack.state.files.length).toEqual(1);
    expect(stack.state.files[0].title).toEqual("logo.png");

    const decryptedFile = await akord.getStackFile(stackId);
    expect(Buffer.from(decryptedFile)).toEqual(file.data);
  });

  it("should upload new revision", async () => {
    const file = getFileFromPath("./src/__tests__/data/avatar.jpeg");
    file.type = "image/jpeg";

    await akord.stack.uploadRevision(stackId, file);

    const stack = await akord.decryptObject(stackId, "Stack");
    expect(stack.state.files.length).toEqual(2);
    expect(stack.state.files[0].title).toEqual("logo.png");
    expect(stack.state.files[1].title).toEqual("avatar.jpeg");

    const decryptedFile = await akord.getStackFile(stackId);
    expect(Buffer.from(decryptedFile)).toEqual(file.data);

    const firstFile = getFileFromPath("./src/__tests__/data/logo.png");
    const decryptedFirstFile = await akord.getFile(stack.state.files[0].resourceUrl, vaultId);
    expect(Buffer.from(decryptedFirstFile)).toEqual(firstFile.data);
  });

  it("should rename the stack", async () => {
    const name = faker.random.words();

    await akord.stack.rename(stackId, name);

    const stack = await akord.decryptObject(stackId, "Stack");
    expect(stack.state.title).toEqual(name);
    expect(stack.state.files.length).toEqual(2);
    expect(stack.state.files[0].title).toEqual("logo.png");
    expect(stack.state.files[1].title).toEqual("avatar.jpeg");

    const firstFile = getFileFromPath("./src/__tests__/data/logo.png");
    const decryptedfirstFile = await akord.getFile(stack.state.files[0].resourceUrl, vaultId);
    expect(Buffer.from(decryptedfirstFile)).toEqual(firstFile.data);

    const secondFile = getFileFromPath("./src/__tests__/data/avatar.jpeg");
    const decryptedSecondFile = await akord.getFile(stack.state.files[1].resourceUrl, vaultId);
    expect(Buffer.from(decryptedSecondFile)).toEqual(secondFile.data);
  });

  it("should revoke the stack", async () => {
    await akord.stack.revoke(stackId)
    const stack = await akord.api.getObject(stackId, "Stack");
    expect(stack.status).toEqual("REVOKED");
  });

  it("should restore the stack", async () => {
    await akord.stack.restore(stackId)
    const stack = await akord.api.getObject(stackId, "Stack");
    expect(stack.status).toEqual("ACTIVE");
  });
});