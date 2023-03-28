export class Forbidden extends Error {
  statusCode: number = 403;

  constructor(message: string) {
    super(message);
  }
}