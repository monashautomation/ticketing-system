import { headers } from 'next/headers';
import { auth } from './auth';
import { ForbiddenError, UnauthorizedError } from './errors';

export async function getCurrentSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== 'admin') throw new ForbiddenError();
  return session;
}
