import { Akord } from "../index";
import faker from '@faker-js/faker';
import { cleanup, initInstance } from './common';

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing note functions", () => {
  let vaultId: string;
  let noteId: string;
  let name: string;
  let tag: string;

  beforeEach(async () => {
    akord = await initInstance();
  });

  beforeAll(async () => {
    akord = await initInstance();
    vaultId = (await akord.vault.create(faker.random.words(), {
      public: true,
      cloud: true
    })).vaultId;
  });

  afterAll(async () => {
    await cleanup(vaultId);
  });

  it("should create new note", async () => {
    name = faker.random.words();
    tag = faker.lorem.word();
    const content = faker.lorem.sentences();

    noteId = (await akord.note.create(vaultId, content, name, { tags: [tag] })).noteId;

    const note = await akord.note.get(noteId);
    expect(note.name).toEqual(name);
    expect(note.tags).toContain(tag);
    expect(note.versions.length).toEqual(1);
    const { name: fileName, data } = await akord.note.getVersion(noteId);
    expect(data).toEqual(content);
    expect(fileName).toEqual(name);
  });

  it("should search for the previously created note", async () => {
    const filter = {
      name: { contains: name },
      tags: { contains: tag },
      status: { eq: "ACTIVE" }
    };

    const notes = await akord.note.listAll(vaultId, { filter: filter });

    expect(notes.length).toEqual(1);
  });

  it("should upload new revision", async () => {
    const name = faker.random.words();
    const content = faker.lorem.sentences();

    await akord.note.uploadRevision(
      noteId,
      JSON.stringify({ content: content }),
      name,
      { mimeType: "application/json" }
    );

    const note = await akord.note.get(noteId);
    expect(note.versions.length).toEqual(2);
    const { name: fileName, data } = await akord.note.getVersion(noteId);
    expect(JSON.parse(data)).toEqual({ content: content });
    expect(fileName).toEqual(name);
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
    expect(note.versions.length).toEqual(2);
  });
});