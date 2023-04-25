import { Logger } from "../logger";

export class Unauthorized extends Error {
  statusCode: number = 401;

  constructor(message: string, error?: Error) {
    super(message);
    Logger.log(error);
  }
}