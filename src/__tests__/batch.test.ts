import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import fs from "fs";
import path from "path";
import { email, email2, email3, password } from './data/test-credentials';

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

describe("Testing batch actions", () => {
  let vaultId: string;
  let folderId: string;
  let noteId: string;
  let membershipId1: string;
  let membershipId2: string;

  beforeEach(async () => {
    akord = await initInstance(email, password);
  });

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  describe("Batch revoke/restore actions", () => {
    it("should create folder", async () => {
      const name = faker.random.words();
      folderId = (await akord.folder.create(vaultId, name)).folderId;

      const folder = await akord.folder.get(folderId);
      expect(folder.status).toEqual("ACTIVE");
      expect(folder.parentId).toBeFalsy();
      expect(folder.name).toEqual(name);
    });

    it("should create note", async () => {
      const name = faker.random.words();
      const content = faker.lorem.sentences();

      noteId = (await akord.note.create(vaultId, name, content)).noteId;

      const note = await akord.note.get(noteId);
      expect(note.versions.length).toEqual(1);
    });

    it("should revoke all items in a batch", async () => {
      await akord.batch.revoke([
        { id: folderId, objectType: "Folder" },
        { id: noteId, objectType: "Note" },
      ])

      const folder = await akord.folder.get(folderId);
      expect(folder.status).toEqual("REVOKED");

      const note = await akord.note.get(noteId);
      expect(note.status).toEqual("REVOKED");
    });

    it("should restore all items in a batch", async () => {
      await akord.batch.restore([
        { id: folderId, objectType: "Folder" },
        { id: noteId, objectType: "Note" },
      ])

      const folder = await akord.folder.get(folderId);
      expect(folder.status).toEqual("ACTIVE");

      const note = await akord.note.get(noteId);
      expect(note.status).toEqual("ACTIVE");
    });
  });

  describe("Batch upload", () => {
    it("should upload a batch of 10 files", async () => {
      const file = getFileFromPath("./src/__tests__/data/logo.png");
      file.type = "image/png";

      const items = [] as { file: any, name: string }[];

      for (let i = 0; i < 10; i++) {
        const name = faker.random.words();
        items.push({ file, name });
      }

      const response = await akord.batch.stackCreate(vaultId, items);

      for (let index in items) {
        const stack = await akord.stack.get(response[index].stackId);
        expect(stack.status).toEqual("ACTIVE");
        expect(stack.versions.length).toEqual(1);
        expect(stack.versions[0].title).toEqual("logo.png");
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
      ));
      for (let item of response) {
        const membership = await akord.membership.get(item.membershipId);
        if (membership.email === email2) {
          membershipId1 = item.membershipId;
          expect(membership.status).toEqual("PENDING");
          expect(membership.role).toEqual("CONTRIBUTOR");
        } else {
          membershipId2 = item.membershipId;
          expect(membership.status).toEqual("PENDING");
          expect(membership.role).toEqual("VIEWER");
        }
      }
    });

    it("should change access", async () => {
      await akord.batch.membershipChangeRole([
        { id: membershipId1, role: "VIEWER" },
        { id: membershipId2, role: "CONTRIBUTOR" }
      ])

      const membership1 = await akord.membership.get(membershipId1);
      expect(membership1.role).toEqual("VIEWER");

      const membership2 = await akord.membership.get(membershipId2);
      expect(membership2.role).toEqual("CONTRIBUTOR");
    });
  });
});