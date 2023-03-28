import { BadRequest } from "./bad-request";
import { Forbidden } from "./forbidden";
import { InternalError } from "./internal-error";
import { NotFound } from "./not-found";
import { Unauthorized } from "./unauthorized";

export const throwError = (status: number, message?: string) => {
  switch (status) {
    case 400:
      throw new BadRequest(message);
    case 401:
      throw new Unauthorized(message);
    case 403:
      throw new Forbidden(message);
    case 404:
      throw new NotFound(message);
    default:
      throw new InternalError("Internal error. Please try again or contact Akord support.");
  }
}