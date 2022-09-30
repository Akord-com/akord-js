import Akord from "../akord";
import faker from '@faker-js/faker';
import { initInstance } from './helpers';
import fs from "fs";
import path from "path";
import { email, password } from './data/test-credentials';

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

describe("Testing profile commands", () => {
  beforeAll(async () => {
    akord = await initInstance(email, password);
  });

  it("should update the profile", async () => {
    const name = faker.random.words();

    const file = getFileFromPath("./src/__tests__/data/logo.png");
    await akord.profile.update(name, file.data);

    const profileDetails = await akord.profile.get();
    expect(profileDetails.fullName).toEqual(name);
    expect(profileDetails.avatar).not.toBeNull();
    expect(Buffer.from(profileDetails.avatar || new ArrayBuffer(1))).toEqual(file.data);
  });
});