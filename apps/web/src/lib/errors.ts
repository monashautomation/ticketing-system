export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Forbidden');
  }
}

/** Expected, user-facing business-rule failure (e.g. "invalid code"). Safe to
 * return verbatim to the client — never use this for unexpected/internal errors. */
export class AppError extends Error {}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
  }
}
