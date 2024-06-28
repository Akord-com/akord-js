require("dotenv").config();
import { AkordWallet } from "@akord/crypto";
import { Akord, Auth } from "../index";
import faker from '@faker-js/faker';
import { email, password } from './data/test-credentials';
import { isArweaveId } from "../arweave";

export async function initInstance(): Promise<Akord> {
  if (process.env.API_KEY && process.env.BACKUP_PHRASE) {
    console.log("API KEY FLOW")
    Auth.configure({ env: process.env.ENV as any, apiKey: process.env.API_KEY });
    const wallet = await AkordWallet.importFromBackupPhrase(process.env.BACKUP_PHRASE);
    return new Akord(wallet, { debug: true, logToFile: true, env: process.env.ENV as any });
  } else {
    if (!password || !email) {
      throw new Error("Please configure Akord credentials: email, password.");
    }
    Auth.configure({ env: process.env.ENV as any });
    const { wallet } = await Auth.signIn(email, password);
    return new Akord(wallet, { debug: true, logToFile: true, env: process.env.ENV as any });
  }
}

export async function setupVault(cloud = true): Promise<string> {
  const akord = await initInstance();
  const { vaultId } = await vaultCreate(akord, cloud);
  return vaultId;
}

export async function cleanup(vaultId: string): Promise<void> {
  if (vaultId) {
    const akord = await initInstance();
    await akord.vault.delete(vaultId);
  }
  await Auth.signOut();
}

export const vaultCreate = async (akord: Akord, cloud = true) => {
  const name = faker.random.words();
  const termsOfAccess = faker.lorem.sentences();
  const { vaultId, membershipId } = await akord.vault.create(name, { termsOfAccess, cloud: cloud });

  const membership = await akord.membership.get(membershipId);
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.role).toEqual("OWNER");
  expect(membership.data?.length).toEqual(1);
  expect(isArweaveId(membership.data?.[0] as string)).toEqual(cloud ? false : true);

  const vault = await akord.vault.get(vaultId);
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.name).toEqual(name);
  expect(vault.data?.length).toEqual(1);
  expect(isArweaveId(vault.data?.[0] as string)).toEqual(cloud ? false : true);
  return { vaultId, membershipId };
}

export const folderCreate = async (akord: Akord, vaultId: string, parentId?: string) => {
  const name = faker.random.words();
  const { folderId } = await akord.folder.create(vaultId, name, { parentId: parentId });

  const folder = await akord.folder.get(folderId);
  expect(folder.data?.length).toEqual(1);
  const vault = await akord.vault.get(vaultId);
  expect(isArweaveId(folder.data?.[0] as string)).toEqual(vault.cloud ? false : true);
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

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const testDataPath = "./src/__tests__/data/";
export const testDataOutPath = "./src/__tests__/data/out";
