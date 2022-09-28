import Akord from "../akord";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import { email, password } from './data/test-credentials';

let akord: Akord;

jest.setTimeout(3000000);

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

describe("Testing note commands", () => {
  let vaultId: string;
  let noteId: string;

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  it("should create new note", async () => {
    const name = faker.random.words();
    const content = faker.lorem.sentences();

    noteId = (await akord.note.create(vaultId, name, content)).noteId;

    const note = await akord.decryptObject(noteId, "Note");
    expect(note.state.revisions.length).toEqual(1);
    expect(JSON.parse(note.state.content)).toEqual(content);
  });

  it("should upload new revision", async () => {
    const name = faker.random.words();
    const content = faker.lorem.sentences();

    await akord.note.uploadRevision(noteId, name, content);

    const note = await akord.api.getObject(noteId, "Note");
    expect(note.state.revisions.length).toEqual(2);
  });

  it("should revoke the note", async () => {
    await akord.note.revoke(noteId);

    const note = await akord.api.getObject(noteId, "Note");
    expect(note.status).toEqual("REVOKED");
  });

  it("should restore the note", async () => {
    await akord.note.restore(noteId);

    const note = await akord.api.getObject(noteId, "Note");
    expect(note.status).toEqual("ACTIVE");
    expect(note.state.revisions.length).toEqual(2);
  });
});