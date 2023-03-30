import { Logger } from "../logger";

export class BadRequest extends Error {
  statusCode: number = 400;

  constructor(message: string, error?: any) {
    super(message);
    Logger.log(error);
  }
}