import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance, testDataPath, testDataOutPath, vaultCreate } from './common';
import { email, password } from './data/test-credentials';
import { getTxData } from "../arweave";
import { firstFileName, secondFileName, arweaveImportFileTx } from './data/content';
import { createFileLike } from "../core/file";
import fs from "fs";

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

  it("should create stack from path", async () => {
    const name = faker.random.words();

    const { stackId, uri } = await akord.stack.create(vaultId, testDataPath + firstFileName, name);
    expect(stackId).toBeTruthy();
    expect(uri).toBeTruthy();

    const stack = await akord.stack.get(stackId);
    expect(stack.uri).toBeTruthy();
    expect(stack.status).toEqual("ACTIVE");
    expect(stack.name).toEqual(name);
    expect(stack.versions.length).toEqual(1);
    expect(stack.versions[0].name).toEqual(firstFileName);

    const { data } = await akord.stack.getVersion(stack.id, 0);
    const file = await createFileLike(testDataPath + firstFileName);
    expect(stack.versions[0].type).toEqual(file.type);
    expect(data).toEqual(await file.arrayBuffer());
  });

  it("should create stack from file buffer", async () => {
    const name = faker.random.words();

    const fileBuffer = fs.readFileSync(testDataPath + firstFileName);
    const type = "image/png";

    const { stackId, uri } = await akord.stack.create(vaultId, fileBuffer, name, { name: firstFileName, mimeType: type });
    expect(stackId).toBeTruthy();
    expect(uri).toBeTruthy();

    const stack = await akord.stack.get(stackId);
    expect(stack.uri).toBeTruthy();
    expect(stack.status).toEqual("ACTIVE");
    expect(stack.name).toEqual(name);
    expect(stack.versions.length).toEqual(1);
    expect(stack.versions[0].name).toEqual(firstFileName);
    expect(stack.versions[0].type).toEqual(type);

    const { data } = await akord.stack.getVersion(stackId, 0);
    const file = await createFileLike(testDataPath + firstFileName);
    expect(data).toEqual(await file.arrayBuffer());
  });

  it("should create stack from file stream", async () => {
    const name = faker.random.words();

    const fileStream = fs.createReadStream(testDataPath + firstFileName);
    const type = "image/png";

    const { stackId, uri } = await akord.stack.create(vaultId, fileStream, name, { name: firstFileName, mimeType: type });
    expect(stackId).toBeTruthy();
    expect(uri).toBeTruthy();

    const stack = await akord.stack.get(stackId);
    expect(stack.uri).toBeTruthy();
    expect(stack.status).toEqual("ACTIVE");
    expect(stack.name).toEqual(name);
    expect(stack.versions.length).toEqual(1);
    expect(stack.versions[0].name).toEqual(firstFileName);
    expect(stack.versions[0].type).toEqual(type);

    const { data } = await akord.stack.getVersion(stackId, 0);
    const file = await createFileLike(testDataPath + firstFileName);
    expect(data).toEqual(await file.arrayBuffer());
  });

  it("should create stack from file object", async () => {
    const name = faker.random.words();

    const file = await createFileLike(testDataPath + firstFileName);

    stackId = (await akord.stack.create(vaultId, file, name)).stackId;

    const stack = await akord.stack.get(stackId);
    expect(stack.uri).toBeTruthy();
    expect(stack.status).toEqual("ACTIVE");
    expect(stack.name).toEqual(name);
    expect(stack.versions.length).toEqual(1);
    expect(stack.versions[0].name).toEqual(firstFileName);
    expect(stack.versions[0].type).toEqual(file.type);

    const { data } = await akord.stack.getVersion(stackId, 0);
    expect(data).toEqual(await file.arrayBuffer());
  });


  it("should download the stack", async () => {
    const { name, data } = await akord.stack.getVersion(stackId, 0);
    await akord.stack.download(stackId, 0, { path: testDataOutPath });
    const file = await createFileLike(`${testDataOutPath}/${name}`);

    expect(data).toEqual(await file.arrayBuffer());
  });

  it("should upload new revision", async () => {
    const { uri } = await akord.stack.uploadRevision(stackId, testDataPath + secondFileName);
    expect(uri).toBeTruthy();

    const stack = await akord.stack.get(stackId);
    expect(stack.uri).toBeTruthy();
    expect(stack.versions.length).toEqual(2);
    expect(stack.versions[0].name).toEqual(firstFileName);
    expect(stack.versions[1].name).toEqual(secondFileName);

    const { data } = await akord.stack.getVersion(stackId);
    const file = await createFileLike(testDataPath + secondFileName);
    expect(stack.versions[1].type).toEqual(file.type);
    expect(data).toEqual(await file.arrayBuffer());

    const firstFile = await createFileLike(testDataPath + firstFileName);
    const { data: firstFileData } = await akord.stack.getVersion(stackId, 0);
    expect(firstFileData).toEqual(await firstFile.arrayBuffer());
  });

  it("should rename the stack", async () => {
    const name = faker.random.words();

    await akord.stack.rename(stackId, name);

    const stack = await akord.stack.get(stackId);
    expect(stack.uri).toBeTruthy();
    expect(stack.name).toEqual(name);
    expect(stack.versions.length).toEqual(2);
    expect(stack.versions[0].name).toEqual(firstFileName);
    expect(stack.versions[1].name).toEqual(secondFileName);

    const firstFile = await createFileLike(testDataPath + firstFileName);
    const { data: firstFileData } = await akord.stack.getVersion(stackId, 0);
    expect(firstFileData).toEqual(await firstFile.arrayBuffer());

    const secondFile = await createFileLike(testDataPath + secondFileName);

    const { data: secondFileData } = await akord.stack.getVersion(stackId);
    expect(secondFileData).toEqual(await secondFile.arrayBuffer());
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

  it("should import new stack from arweave tx", async () => {
    const fileName = arweaveImportFileTx + ".jpeg";
    const { stackId } = await akord.stack.import(vaultId, arweaveImportFileTx);

    const stack = await akord.stack.get(stackId);
    expect(stack.name).toEqual(fileName);
    expect(stack.versions.length).toEqual(1);
    expect(stack.versions[0].name).toEqual(fileName);

    const { data } = await akord.stack.getVersion(stackId);
    expect(data).toEqual(await getTxData(arweaveImportFileTx));
  });
});
