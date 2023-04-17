import { Logger } from "../logger";

export class NotFound extends Error {
  statusCode: number = 404;

  constructor(message: string, error?: any) {
    super(message);
    Logger.log(error);
  }
}