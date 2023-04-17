import { Logger } from "../logger";

export class IncorrectEncryptionKey extends Error {
  statusCode: number = 409;

  constructor(error?: any) {
    super("Incorrect encryption key.");
    Logger.log(error);
  }
}