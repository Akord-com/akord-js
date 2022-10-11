import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import { email, password } from './data/test-credentials';

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

    const note = await akord.note.get(noteId);
    expect(note.revisions.length).toEqual(1);
    expect(JSON.parse(note.content)).toEqual(content);
  });

  it("should upload new revision", async () => {
    const name = faker.random.words();
    const content = faker.lorem.sentences();

    await akord.note.uploadRevision(noteId, name, content);

    const note = await akord.note.get(noteId);
    expect(note.revisions.length).toEqual(2);
  });

  it("should revoke the note", async () => {
    await akord.note.revoke(noteId);

    const note = await akord.note.get(noteId);
    expect(note.status).toEqual("REVOKED");
  });

  it("should restore the note", async () => {
    await akord.note.restore(noteId);

    const note = await akord.note.get(noteId);
    expect(note.status).toEqual("ACTIVE");
    expect(note.revisions.length).toEqual(2);
  });
});