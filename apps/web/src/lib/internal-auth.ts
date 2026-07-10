import { timingSafeEqual } from 'node:crypto';
import { env } from './env';
import { UnauthorizedError } from './session';

/** Validates the shared-secret header the Discord bot sends on internal API calls. */
export function requireInternalSecret(request: Request): void {
  const provided = request.headers.get('x-internal-secret') ?? '';
  const expected = env.internalApiSecret;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const isValid = a.length === b.length && timingSafeEqual(a, b);

  if (!isValid) throw new UnauthorizedError();
}
