import { Akord } from "../index";
import { initInstance } from './common';
import { email, password } from './data/test-credentials';


let akord: Akord;

jest.setTimeout(3000000);

describe("Testing zip functions", () => {

  beforeAll(async () => {
    akord = await initInstance(email, password);
  });

  it("should get storage balance", async () => {
    const storageBalance = await akord.storage.get();
    expect(storageBalance).toBeTruthy();
    expect(storageBalance.cloudStorageTotal).toBeGreaterThan(0);
    expect(storageBalance.permanentStorageTotal).toBeGreaterThan(0);
    expect(storageBalance.cloudStorageAvailable).toBeGreaterThanOrEqual(0);
    expect(storageBalance.permanentStorageAvailable).toBeGreaterThanOrEqual(0);
  });

  it("should simulate payment", async () => {
    const storageBalance = await akord.storage.buy(1);
    console.log(storageBalance)
  });
});
