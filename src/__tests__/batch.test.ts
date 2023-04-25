import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance, folderCreate, noteCreate, testDataPath, vaultCreate } from './common';
import { email, email2, email3, password } from './data/test-credentials';
import { NodeJs } from "../types/file";
import { firstFileName } from "./data/content";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing batch actions", () => {
  let vaultId: string;
  let folderId: string;
  let noteId: string;
  let viewerId: string;
  let contributorId: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate(akord)).vaultId;
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
        { id: noteId, type: "Note" },
      ])

      const folder = await akord.folder.get(folderId);
      expect(folder.status).toEqual("REVOKED");

      const note = await akord.note.get(noteId);
      expect(note.status).toEqual("REVOKED");
    });

    it("should restore all items in a batch", async () => {
      await akord.batch.restore([
        { id: folderId, type: "Folder" },
        { id: noteId, type: "Note" },
      ])

      const folder = await akord.folder.get(folderId);
      expect(folder.status).toEqual("ACTIVE");

      const note = await akord.note.get(noteId);
      expect(note.status).toEqual("ACTIVE");
    });
  });

  describe("Batch upload", () => {
    it("should upload a batch of 10 files", async () => {
      const file = await NodeJs.File.fromPath(testDataPath + firstFileName);

      const items = [] as { file: any, name: string }[];

      for (let i = 0; i < 2; i++) {
        const name = faker.random.words();
        items.push({ file, name });
      }

      const response = (await akord.batch.stackCreate(vaultId, items)).data;

      for (let index in items) {
        const stack = await akord.stack.get(response[index].stackId);
        expect(stack.status).toEqual("ACTIVE");
        expect(stack.name).toEqual(response[index].object.name);
        expect(stack.versions.length).toEqual(1);
        expect(stack.versions[0].name).toEqual(firstFileName);
      }
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
});