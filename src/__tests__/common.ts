require("dotenv").config();
import { Akord, Auth } from "../index";
import faker from '@faker-js/faker';

export async function initInstance(email: string, password: string): Promise<Akord> {
  Auth.configure({ env: process.env.ENV as any });
  const { wallet } = await Auth.signIn(email, password);
  return new Akord(wallet, { debug: true, env: process.env.ENV as any });
}

export const vaultCreate = async (akord: Akord, cacheOnly = true) => {
  const name = faker.random.words();
  const termsOfAccess = faker.lorem.sentences();
  const { vaultId, membershipId } = await akord.vault.create(name, { termsOfAccess, cacheOnly: cacheOnly });

  const membership = await akord.membership.get(membershipId);
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.role).toEqual("OWNER");

  const vault = await akord.vault.get(vaultId);
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.name).toEqual(name);
  return { vaultId, membershipId };
}

export const folderCreate = async (akord: Akord, vaultId: string, parentId?: string) => {
  const name = faker.random.words();
  const { folderId } = await akord.folder.create(vaultId, name, { parentId: parentId });

  const folder = await akord.folder.get(folderId);
  expect(folder.status).toEqual("ACTIVE");
  if (parentId) {
    expect(folder.parentId).toEqual(parentId);
  } else {
    expect(folder.parentId).toBeFalsy();
  }
  expect(folder.name).toEqual(name);
  return folderId;
}

export const noteCreate = async (akord: Akord, vaultId: string) => {
  const name = faker.random.words();
  const content = faker.lorem.sentences();

  const { noteId } = await akord.note.create(vaultId, content, name);

  const note = await akord.note.get(noteId);
  expect(note.versions.length).toEqual(1);
  const { name: fileName, data } = await akord.note.getVersion(noteId);
  expect(data).toEqual(content);
  expect(fileName).toEqual(name);
  return noteId;
}

export const testDataPath = "./src/__tests__/data/";
