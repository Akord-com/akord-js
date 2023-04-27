import { Logger } from "../logger";

export class Forbidden extends Error {
  statusCode: number = 403;

  constructor(message: string, error?: Error) {
    super(message);
    Logger.log(error);
  }
}