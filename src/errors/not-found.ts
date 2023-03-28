export class NotFound extends Error {
  statusCode: number = 404;

  constructor(message: string) {
    super(message);
  }
}