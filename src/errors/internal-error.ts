import { Logger } from "../logger";

export class InternalError extends Error {
  statusCode: number = 500;

  constructor(message: string, error?: any) {
    super(message);
    Logger.log(error);
  }
}