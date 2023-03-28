export class TooManyRequests extends Error {
  statusCode: number = 429;

  constructor(message: string) {
    super(message);
  }
}