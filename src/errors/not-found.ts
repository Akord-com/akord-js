import { Logger } from "../logger";

export class NotFound extends Error {
  statusCode: number = 404;

  constructor(message: string, error?: Error) {
    super(message);
    Logger.log(error);
  }
}