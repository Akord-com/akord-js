export class BadRequest extends Error {
  statusCode: number = 400;

  constructor(message: string) {
    super(message);
  }
}