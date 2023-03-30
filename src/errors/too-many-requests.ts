import { Logger } from "../logger";

export class TooManyRequests extends Error {
  statusCode: number = 429;

  constructor(message: string, error?: any) {
    super(message);
    Logger.log(error);
  }
}