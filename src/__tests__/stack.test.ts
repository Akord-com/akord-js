import { Akord } from "../index";
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

  const membership = await akord.membership.get(membershipId);
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.role).toEqual("OWNER");

  const vault = await akord.vault.get(vaultId);
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.name).toEqual(name);
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

    const stack = await akord.stack.get(stackId);
    expect(stack.status).toEqual("ACTIVE");
    expect(stack.name).toEqual(name);
    expect(stack.versions.length).toEqual(1);
    expect(stack.versions[0].name).toEqual("logo.png");

    const { name: fileName, data } = await akord.stack.getFile(stackId);
    expect(Buffer.from(data)).toEqual(file.data);
    expect(fileName).toEqual("logo.png");
  });

  it("should upload new revision", async () => {
    const file = getFileFromPath("./src/__tests__/data/avatar.jpeg");
    file.type = "image/jpeg";

    await akord.stack.uploadRevision(stackId, file);

    const stack = await akord.stack.get(stackId);
    expect(stack.versions.length).toEqual(2);
    expect(stack.versions[0].name).toEqual("logo.png");
    expect(stack.versions[1].name).toEqual("avatar.jpeg");

    const { name: fileName, data } = await akord.stack.getFile(stackId);
    expect(Buffer.from(data)).toEqual(file.data);
    expect(fileName).toEqual("avatar.jpeg");

    const firstFile = getFileFromPath("./src/__tests__/data/logo.png");
    const decryptedFirstFile = await akord.getFile(stack.files[0].resourceUrl, vaultId);
    expect(Buffer.from(decryptedFirstFile)).toEqual(firstFile.data);
  });

  it("should rename the stack", async () => {
    const name = faker.random.words();

    await akord.stack.rename(stackId, name);

    const stack = await akord.stack.get(stackId);
    expect(stack.name).toEqual(name);
    expect(stack.versions.length).toEqual(2);
    expect(stack.versions[0].name).toEqual("logo.png");
    expect(stack.versions[1].name).toEqual("avatar.jpeg");

    const firstFile = getFileFromPath("./src/__tests__/data/logo.png");
    const decryptedfirstFile = await akord.getFile(stack.files[0].resourceUrl, vaultId);
    expect(Buffer.from(decryptedfirstFile)).toEqual(firstFile.data);

    const secondFile = getFileFromPath("./src/__tests__/data/avatar.jpeg");
    const decryptedSecondFile = await akord.getFile(stack.files[1].resourceUrl, vaultId);
    expect(Buffer.from(decryptedSecondFile)).toEqual(secondFile.data);
  });

  it("should revoke the stack", async () => {
    await akord.stack.revoke(stackId)
    const stack = await akord.stack.get(stackId);
    expect(stack.status).toEqual("REVOKED");
  });

  it("should restore the stack", async () => {
    await akord.stack.restore(stackId)
    const stack = await akord.stack.get(stackId);
    expect(stack.status).toEqual("ACTIVE");
  });
});