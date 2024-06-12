import { Akord } from "../index";
import { initInstance, folderCreate, noteCreate, testDataPath, setupVault, cleanup } from './common';
import { email2, email3 } from './data/test-credentials';
import { firstFileName } from "./data/content";
import { createFileLike } from "../core/file";
import { StackCreateItem } from "../core/batch";
import { EMPTY_FILE_ERROR_MESSAGE } from "../core/stack";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing batch actions", () => {
  let vaultId: string;
  let folderId: string;
  let noteId: string;
  let viewerId: string;
  let contributorId: string;
  let stackIds: string[];

  beforeEach(async () => {
    akord = await initInstance();
  });

  beforeAll(async () => {
    vaultId = await setupVault();
  });

  afterAll(async () => {
    await cleanup(akord, vaultId);
  });

  describe("Batch revoke/restore actions", () => {
    it("should create folder", async () => {
      folderId = await folderCreate(akord, vaultId);
    });

    it("should create note", async () => {
      noteId = await noteCreate(akord, vaultId);
    });

    it("should revoke all items in a batch", async () => {
      await akord.batch.revoke([
        { id: folderId, type: "Folder" },
        { id: noteId, type: "Stack" },
      ])

      const folder = await akord.folder.get(folderId);
      expect(folder.status).toEqual("REVOKED");

      const note = await akord.note.get(noteId);
      expect(note.status).toEqual("REVOKED");
    });

    it("should restore all items in a batch", async () => {
      await akord.batch.restore([
        { id: folderId, type: "Folder" },
        { id: noteId, type: "Stack" },
      ])

      const folder = await akord.folder.get(folderId);
      expect(folder.status).toEqual("ACTIVE");

      const note = await akord.note.get(noteId);
      expect(note.status).toEqual("ACTIVE");
    });
  });

  describe("Batch upload", () => {
    const batchSize = 10;
    it(`should upload a batch of ${batchSize} files`, async () => {
      const file = await createFileLike(testDataPath + firstFileName);

      const items = [] as StackCreateItem[];

      for (let i = 0; i < batchSize; i++) {
        if (i % 2 === 0) {
          items.push({ file });
        } else {
          items.push({ file, options: { name: "override-name.png" } });
        }
      }

      const { data, errors } = await akord.batch.stackCreate(vaultId, items);

      expect(errors.length).toEqual(0);
      expect(data.length).toEqual(batchSize);
      stackIds = data.map((item) => item.stackId);
      let nameCount = 0;
      for (let index in items) {
        const stack = await akord.stack.get(data[index].stackId);
        expect(stack.status).toEqual("ACTIVE");
        expect(stack.name).toEqual(data[index].object.name);
        expect(stack.versions.length).toEqual(1);
        expect([firstFileName, "override-name.png"]).toContain(stack.versions[0].name);
        if (stack.versions[0].name === firstFileName) {
          nameCount++;
        }
      }
      expect(nameCount).toEqual(batchSize / 2);
    });

    it("should revoke the previously uploaded batch", async () => {
      await akord.batch.revoke(stackIds.map(stackId => ({ id: stackId, type: "Stack" })));
    });

    it(`should try to upload 2 files (the empty one should be skipped)`, async () => {
      const { data, errors } = await akord.batch.stackCreate(vaultId, [
        { file: await createFileLike(testDataPath + firstFileName) },
        { file: testDataPath + "empty-file.md" }
      ]);

      expect(errors.length).toEqual(1);
      expect(errors[0].message).toEqual(EMPTY_FILE_ERROR_MESSAGE);
      expect(data.length).toEqual(1);
    });
  });

  describe("Batch membership actions", () => {
    it("should invite new member as CONTRIBUTOR", async () => {
      const response = (await akord.batch.membershipInvite(vaultId,
        [
          { email: email2, role: "CONTRIBUTOR" },
          { email: email3, role: "VIEWER" }
        ]
      )).data;
      for (let item of response) {
        const membership = await akord.membership.get(item.membershipId);
        if (membership.email === email2) {
          contributorId = item.membershipId;
          expect(membership.status).toEqual("PENDING");
          expect(membership.role).toEqual("CONTRIBUTOR");
        } else {
          viewerId = item.membershipId;
          expect(membership.status).toEqual("PENDING");
          expect(membership.role).toEqual("VIEWER");
        }
      }
    });

    it("should change access", async () => {
      await akord.batch.membershipChangeRole([
        { id: contributorId, role: "VIEWER" },
        { id: viewerId, role: "CONTRIBUTOR" }
      ])

      const membership1 = await akord.membership.get(contributorId);
      expect(membership1.role).toEqual("VIEWER");

      const membership2 = await akord.membership.get(viewerId);
      expect(membership2.role).toEqual("CONTRIBUTOR");
    });
  });

  describe("Batch upload - stress testing", () => {
    const batchSize = 1000;
    it(`should upload a batch of ${batchSize} files`, async () => {
      const fileName = "logo.png"
      const file = await createFileLike(testDataPath + fileName);

      const items = [] as StackCreateItem[];

      for (let i = 0; i < batchSize; i++) {
        items.push({ file });
      }

      const { data, errors } = await akord.batch.stackCreate(vaultId, items);

      expect(errors.length).toEqual(0);
      expect(data.length).toEqual(batchSize);
      stackIds = data.map((item) => item.stackId);
      for (let index in items) {
        const stack = await akord.stack.get(data[index].stackId);
        expect(stack.status).toEqual("ACTIVE");
        expect(stack.name).toEqual(data[index].object.name);
        expect(stack.versions.length).toEqual(1);
        expect(stack.versions[0].name).toEqual(fileName);
      }
    });
  });
});