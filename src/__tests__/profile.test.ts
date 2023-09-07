import { Akord } from "../index";
import faker from '@faker-js/faker';
import { initInstance, testDataPath } from './common';
import { email, password } from './data/test-credentials';
import { NodeJs } from "../types/file";
import { firstFileName } from "./data/content";

let akord: Akord;

jest.setTimeout(3000000);

describe("Testing profile functions", () => {
  beforeAll(async () => {
    akord = await initInstance(email, password);
  });

  it("should get the profile", async () => {
    const profileDetails = await akord.profile.get();
    expect(profileDetails).toBeTruthy();
  });

  // it("should update the profile", async () => {
  //   const name = faker.random.words();

  //   const file = await NodeJs.File.fromPath(testDataPath + firstFileName);
  //   const fileBuffer = await file.arrayBuffer();
  //   await akord.profile.update(name, fileBuffer);

  //   const profileDetails = await akord.profile.get();
  //   expect(profileDetails.name).toEqual(name);
  //   expect(profileDetails.avatar).toEqual(fileBuffer);
  // });
});