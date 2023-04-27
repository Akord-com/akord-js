import { Logger } from "../logger";

export class InternalError extends Error {
  statusCode: number = 500;

  constructor(message: string, error?: Error) {
    super(message);
    Logger.log(error);
  }
}