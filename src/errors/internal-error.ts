export class InternalError extends Error {
  statusCode: number = 500;

  constructor(message: string) {
    super(message);
  }
}