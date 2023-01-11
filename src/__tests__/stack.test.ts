import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import { email, password } from './data/test-credentials';
import { NodeJs } from "../types/file";

let akord: Akord;

jest.setTimeout(3000000);

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

describe("Testing stack functions", () => {
  let vaultId: string;
  let stackId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  it("should create new stack", async () => {
    const name = faker.random.words();

    const file = NodeJs.File.fromPath("./src/__tests__/data/logo.png");

    stackId = (await akord.stack.create(vaultId, file, name)).stackId;

    const stack = await akord.stack.get(stackId);
    expect(stack.status).toEqual("ACTIVE");
    expect(stack.name).toEqual(name);
    expect(stack.versions.length).toEqual(1);
    expect(stack.versions[0].name).toEqual("logo.png");

    const isChunked = stack.files[0].resourceUrl.numberOfChunks > 1
    const binary = await akord.file.get(stack.files[0].resourceUrl, vaultId, { isChunked: isChunked, numberOfChunks: stack.files[0].resourceUrl.numberOfChunks } );
    expect(binary).toEqual(await file.arrayBuffer());
  });

  it("should upload new revision", async () => {
    const file = NodeJs.File.fromPath("./src/__tests__/data/avatar.jpeg");

    await akord.stack.uploadRevision(stackId, file);

    const stack = await akord.stack.get(stackId);
    expect(stack.versions.length).toEqual(2);
    expect(stack.versions[0].name).toEqual("logo.png");
    expect(stack.versions[1].name).toEqual("avatar.jpeg");

    const binary = await akord.file.get(stack.files[1].resourceUrl, vaultId);
    expect(binary).toEqual(await file.arrayBuffer());

    const firstFile = NodeJs.File.fromPath("./src/__tests__/data/logo.png");
    const decryptedFirstFile = await akord.file.get(stack.files[0].resourceUrl, vaultId);
    expect(decryptedFirstFile).toEqual(await firstFile.arrayBuffer());
  });

  it("should rename the stack", async () => {
    const name = faker.random.words();

    await akord.stack.rename(stackId, name);

    const stack = await akord.stack.get(stackId);
    expect(stack.name).toEqual(name);
    expect(stack.versions.length).toEqual(2);
    expect(stack.versions[0].name).toEqual("logo.png");
    expect(stack.versions[1].name).toEqual("avatar.jpeg");

    const firstFile = NodeJs.File.fromPath("./src/__tests__/data/logo.png");
    const decryptedfirstFile = await akord.file.get(stack.files[0].resourceUrl, vaultId);
    expect(decryptedfirstFile).toEqual(await firstFile.arrayBuffer());

    const secondFile = NodeJs.File.fromPath("./src/__tests__/data/avatar.jpeg");

    const decryptedSecondFile = await akord.file.get(stack.files[1].resourceUrl, vaultId);
    expect(decryptedSecondFile).toEqual(await secondFile.arrayBuffer());
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
