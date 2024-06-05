import { Akord } from "../index";
import faker from '@faker-js/faker';
import { cleanup, initInstance, setupVault } from './common';
import { reactionEmoji } from '../constants';

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing memo functions", () => {
  let vaultId: string;
  let memoId: string;

  beforeEach(async () => {
    akord = await initInstance();
  });

  beforeAll(async () => {
    vaultId = await setupVault();
  });

  afterAll(async () => {
    await cleanup(akord, vaultId);
  });

  it("should create new memo", async () => {
    const message = faker.lorem.sentences(50);
    memoId = (await akord.memo.create(vaultId, message)).memoId;
    const memo = await akord.memo.get(memoId);
    expect(memo.versions[0].message).toEqual(message);
  });

  it("should add JOY reaction emoji", async () => {
    await akord.memo.addReaction(memoId, reactionEmoji.JOY);

    const memo = await akord.memo.get(memoId);
    expect(memo.versions[0].reactions!.length).toEqual(1);
    expect(memo.versions[0].reactions![0].reaction).toEqual(reactionEmoji.JOY);
  });

  it("should add FIRE reaction emoji", async () => {
    await akord.memo.addReaction(memoId, reactionEmoji.FIRE);

    const memo = await akord.memo.get(memoId);
    expect(memo.versions[0].reactions!.length).toEqual(2);
    expect(memo.versions[0].reactions![1].reaction).toEqual(reactionEmoji.FIRE);
  });

  it("should remove JOY reaction emoji", async () => {
    await akord.memo.removeReaction(memoId, reactionEmoji.JOY);

    const memo = await akord.memo.get(memoId);
    expect(memo.versions[0].reactions!.length).toEqual(1);
    expect(memo.versions[0].reactions![0].reaction).toEqual(reactionEmoji.FIRE);
  });
});