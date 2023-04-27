import { BadRequest } from "./bad-request";
import { Forbidden } from "./forbidden";
import { InternalError } from "./internal-error";
import { NotFound } from "./not-found";
import { Unauthorized } from "./unauthorized";

export const throwError = (status: number, message?: string, error?: Error) => {
  switch (status) {
    case 400:
      throw new BadRequest(message, error);
    case 401:
      throw new Unauthorized(message, error);
    case 403:
      throw new Forbidden(message, error);
    case 404:
      throw new NotFound(message, error);
    default:
      throw new InternalError("Internal error. Please try again or contact Akord support.", error);
  }
}