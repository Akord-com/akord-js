import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import { reactionEmoji } from '../constants';
import { email, password } from './data/test-credentials';

let akord: Akord;

jest.setTimeout(3000000);

async function vaultCreate() {
  const name = faker.random.words();
  const termsOfAccess = faker.lorem.sentences();
  const { vaultId, membershipId } = await akord.vault.create(name, termsOfAccess);

  const membership = await akord.membership.get(membershipId);
  expect(membership.status).toEqual("ACCEPTED");
  expect(membership.state.role).toEqual("OWNER");

  const vault = await akord.vault.get(vaultId);
  expect(vault.status).toEqual("ACTIVE");
  expect(vault.state.title).toEqual(name);
  return { vaultId };
}

describe("Testing memo commands", () => {
  let vaultId: string;
  let memoId: string;

  beforeAll(async () => {
    akord = await initInstance(email, password);
    vaultId = (await vaultCreate()).vaultId;
  });

  it("should create new memo", async () => {
    const message = faker.lorem.sentences(50);
    memoId = (await akord.memo.create(vaultId, message)).memoId;

    const memo = await akord.memo.get(memoId);
    expect(memo.state.message).toEqual(message);
  });

  it("should add JOY reaction emoji", async () => {
    await akord.memo.addReaction(memoId, reactionEmoji.JOY);

    const memo = await akord.memo.get(memoId);
    expect(memo.state.reactions.length).toEqual(1);
    expect(memo.state.reactions[0].reaction).toEqual(reactionEmoji.JOY);
  });

  it("should add FIRE reaction emoji", async () => {
    await akord.memo.addReaction(memoId, reactionEmoji.FIRE);

    const memo = await akord.memo.get(memoId);
    expect(memo.state.reactions.length).toEqual(2);
    expect(memo.state.reactions[1].reaction).toEqual(reactionEmoji.FIRE);
  });

  it("should remove JOY reaction emoji", async () => {
    await akord.memo.removeReaction(memoId, reactionEmoji.JOY);

    const memo = await akord.memo.get(memoId);
    expect(memo.state.reactions.length).toEqual(1);
    expect(memo.state.reactions[0].reaction).toEqual(reactionEmoji.FIRE);
  });
});