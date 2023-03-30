import { Logger } from "../logger";

export class Forbidden extends Error {
  statusCode: number = 403;

  constructor(message: string, error?: any) {
    super(message);
    Logger.log(error);
  }
}