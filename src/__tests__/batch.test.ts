import Akord from "../akord";
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

  const membership = await akord.api.getObject(membershipId, "Membership");
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.state.role).toEqual("OWNER");

  const vault = await akord.decryptObject(vaultId, "Vault");
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.state.title).toEqual(name);
  return { vaultId };
}

describe("Testing batch actions", () => {
  let vaultId: string;
  let folderId: string;
  let noteId: string;
  let membershipId1: string;
  let membershipId2: string;

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  describe("Batch revoke/restore actions", () => {
    it("should create folder", async () => {
      const name = faker.random.words();
      folderId = (await akord.folder.create(vaultId, name)).folderId;

      const folder = await akord.api.getObject(folderId, "Folder");
      expect(folder.status).toEqual("ACTIVE");
      expect(folder.folderId).toEqual(null);

      const decryptedState = await akord.service.processReadObject(folder.state, ["title"]);
      expect(decryptedState.title).toEqual(name);
    });

    it("should create note", async () => {
      const name = faker.random.words();
      const content = faker.lorem.sentences();

      noteId = (await akord.note.create(vaultId, name, content)).noteId;

      const note = await akord.api.getObject(noteId, "Note");
      expect(note.state.revisions.length).toEqual(1);
    });

    it("should revoke all items in a batch", async () => {
      await akord.batchRevoke([
        { id: folderId, objectType: "Folder" },
        { id: noteId, objectType: "Note" },
      ])

      const folder = await akord.api.getObject(folderId, "Folder");
      expect(folder.status).toEqual("REVOKED");

      const note = await akord.api.getObject(noteId, "Note");
      expect(note.status).toEqual("REVOKED");
    });

    it("should restore all items in a batch", async () => {
      await akord.batchRestore([
        { id: folderId, objectType: "Folder" },
        { id: noteId, objectType: "Note" },
      ])

      const folder = await akord.api.getObject(folderId, "Folder");
      expect(folder.status).toEqual("ACTIVE");

      const note = await akord.api.getObject(noteId, "Note");
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

      const response = await akord.batchStackCreate(vaultId, items);

      for (let index in items) {
        const stack = await akord.decryptObject(response[index].stackId, "Stack");
        expect(stack.status).toEqual("ACTIVE");
        expect(stack.state.files.length).toEqual(1);
        expect(stack.state.files[0].title).toEqual("logo.png");
      }
    });
  });

  describe("Batch membership actions", () => {
    it("should invite new member as CONTRIBUTOR", async () => {
      const response = (await akord.batchMembershipInvite(vaultId,
        [
          { email: email2, role: "CONTRIBUTOR" },
          { email: email3, role: "VIEWER" }
        ]
      ));
      for (let item of response) {
        const membership = await akord.api.getObject(item.membershipId, "Membership");
        if (membership.email === email2) {
          membershipId1 = item.membershipId;
          expect(membership.status).toEqual("PENDING");
          expect(membership.state.role).toEqual("CONTRIBUTOR");
        } else {
          membershipId2 = item.membershipId;
          expect(membership.status).toEqual("PENDING");
          expect(membership.state.role).toEqual("VIEWER");
        }
      }
    });

    it("should change access", async () => {
      await akord.batchMembershipChangeRole([
        { id: membershipId1, role: "VIEWER" },
        { id: membershipId2, role: "CONTRIBUTOR" }
      ])

      const membership1 = await akord.api.getObject(membershipId1, "Membership");
      expect(membership1.state.role).toEqual("VIEWER");

      const membership2 = await akord.api.getObject(membershipId2, "Membership");
      expect(membership2.state.role).toEqual("CONTRIBUTOR");
    });
  });
});