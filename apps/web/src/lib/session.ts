import { headers } from 'next/headers';
import { auth } from './auth';

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
