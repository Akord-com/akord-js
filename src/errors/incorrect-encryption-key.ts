import { Logger } from "../logger";

export class IncorrectEncryptionKey extends Error {
  statusCode: number = 409;

  constructor(error?: Error) {
    super("Incorrect encryption key.");
    Logger.log(error);
  }
}