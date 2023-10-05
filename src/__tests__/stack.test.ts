import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance, testDataPath, testDataOutPath, vaultCreate } from './common';
import { email, password } from './data/test-credentials';
import { NodeJs } from "../types/file-like";
import { getTxData } from "../arweave";
import { firstFileName, secondFileName, arweaveImportFileTx } from './data/content';

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing stack functions", () => {
  let vaultId: string;
  let stackId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate(akord)).vaultId;
  });

  it("should create new stack", async () => {
    stackId = await stackCreate(vaultId);
  });

  it("should download the stack", async () => {
    await stackDownload(stackId);
  });

  it("should upload new revision", async () => {
    await stackUploadRevision(stackId);
  });

  it("should rename the stack", async () => {
    await stackRename(stackId);
  });

  it("should revoke the stack", async () => {
    await stackRevoke(stackId);
  });

  it("should restore the stack", async () => {
    await stackRestore(stackId);
  });

  it("should import new stack from arweave tx", async () => {
    await stackImport(vaultId);
  });
});

export const stackCreate = async (vaultId: string) => {
  const name = faker.random.words();

  const file = await NodeJs.File.fromPath(testDataPath + firstFileName);

  const { stackId } = await akord.stack.create(vaultId, file, name);

  const stack = await akord.stack.get(stackId);
  expect(stack.status).toEqual("ACTIVE");
  expect(stack.name).toEqual(name);
  expect(stack.versions.length).toEqual(1);
  expect(stack.versions[0].name).toEqual(firstFileName);

  const binary = await akord.stack.getVersion(stack.id, 0, { responseType: 'arraybuffer' });
  expect(binary.data).toEqual(await file.arrayBuffer());
  return stackId;
}

export const stackDownload = async (stackId: string) => {
  const { version, data } = await akord.stack.getVersion(stackId, 0, { responseType: 'arraybuffer' });
  await akord.stack.download(stackId, 0, { path: testDataOutPath });
  const file = await NodeJs.File.fromPath(`${testDataOutPath}/${version.name}`);

  expect(data).toEqual(await file.arrayBuffer());
}

export const stackUploadRevision = async (stackId: string) => {
  const file = await NodeJs.File.fromPath(testDataPath + secondFileName);

  await akord.stack.uploadRevision(stackId, file);

  const stack = await akord.stack.get(stackId);
  expect(stack.versions.length).toEqual(2);
  expect(stack.versions[0].name).toEqual(firstFileName);
  expect(stack.versions[1].name).toEqual(secondFileName);

  const { data } = await akord.stack.getVersion(stackId, 0, { responseType: 'arraybuffer' });
  expect(data).toEqual(await file.arrayBuffer());

  const firstFile = await NodeJs.File.fromPath(testDataPath + firstFileName);
  const { data: firstFileData } = await akord.stack.getVersion(stackId, 0, { responseType: 'arraybuffer' });
  expect(firstFileData).toEqual(await firstFile.arrayBuffer());
}

export const stackRename = async (stackId: string) => {
  const name = faker.random.words();

  await akord.stack.rename(stackId, name);

  const stack = await akord.stack.get(stackId);
  expect(stack.name).toEqual(name);
  expect(stack.versions.length).toEqual(2);
  expect(stack.versions[0].name).toEqual(firstFileName);
  expect(stack.versions[1].name).toEqual(secondFileName);

  const firstFile = await NodeJs.File.fromPath(testDataPath + firstFileName);
  const { data: firstFileData } = await akord.stack.getVersion(stackId, 0, { responseType: 'arraybuffer' });
  expect(firstFileData).toEqual(await firstFile.arrayBuffer());

  const secondFile = await NodeJs.File.fromPath(testDataPath + secondFileName);

  const { data: secondFileData } = await akord.stack.getVersion(stackId, 0, { responseType: 'arraybuffer' });
  expect(secondFileData).toEqual(await secondFile.arrayBuffer());
}

export const stackRevoke = async (stackId: string) => {
  await akord.stack.revoke(stackId)
  const stack = await akord.stack.get(stackId);
  expect(stack.status).toEqual("REVOKED");
}

export const stackRestore = async (stackId: string) => {
  await akord.stack.restore(stackId)
  const stack = await akord.stack.get(stackId);
  expect(stack.status).toEqual("ACTIVE");
}

export const stackImport = async (vaultId: string) => {
  const fileName = arweaveImportFileTx + ".jpeg";
  const { stackId } = await akord.stack.import(vaultId, arweaveImportFileTx);

  const stack = await akord.stack.get(stackId);
  expect(stack.name).toEqual(fileName);
  expect(stack.versions.length).toEqual(1);
  expect(stack.versions[0].name).toEqual(fileName);

  const { data } = await akord.stack.getVersion(stackId, 0, { responseType: 'arraybuffer' });
  expect(data).toEqual(await getTxData(arweaveImportFileTx));
  return stackId;
}
