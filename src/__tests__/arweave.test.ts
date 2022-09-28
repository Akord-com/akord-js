import Akord from "../akord";
import { ArweaveWallet } from "@akord/crypto";
import faker from '@faker-js/faker';
import { wallet, address } from './data/test-credentials';

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing Akord Client without Akord API, only arweave", () => {
  beforeAll(async () => {
    const arweaveWallet = new ArweaveWallet(wallet);
    akord = new Akord(arweaveWallet, undefined, { wallet: <any>"Arweave", network: <any>"mainnet" });
  });

  it("Testing vault:init command", async () => {
    const name = faker.random.words();
    const termsOfAccess = faker.lorem.sentences();
    const { vaultId, membershipId } = await akord.vault.create(name, termsOfAccess);

    const vault = await akord.api.getContractState(vaultId);

    expect(vault.state.status).toEqual("ACTIVE");
    expect(vault.state.owner).toEqual(address);
    expect(vault.state.data.length).toEqual(1);
    expect(vault.state.memberships.length).toEqual(1);
    expect(vault.state.memberships[0].id).toEqual(membershipId);
    expect(vault.state.memberships[0].address).toEqual(address);
    expect(vault.state.memberships[0].status).toEqual("ACCEPTED");
    expect(vault.state.memberships[0].role).toEqual("OWNER");
    expect(vault.state.memberships[0].data.length).toEqual(1);
  });
});