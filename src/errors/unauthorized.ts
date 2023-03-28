export class Unauthorized extends Error {
  statusCode: number = 401;

  constructor(message: string) {
    super(message);
  }
}