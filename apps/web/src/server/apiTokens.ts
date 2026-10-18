import crypto from 'node:crypto';
import { prisma } from '@ticketing/db';
import { logger } from '@/lib/logger';
import { writeAuditLog } from '@/server/audit';

export const TOKEN_PREFIX = 'matk_';

export interface GeneratedToken {
  /** Plaintext secret — show once, never store. */
  secret: string;
  /** SHA-256 hex of the secret — what gets stored. */
  hash: string;
  /** Short display form, e.g. matk_a1b2…9f0e */
  preview: string;
}

/** Hash a token secret for storage/lookup. */
export function hashToken(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/** Generate a new API token secret. Format: matk_<64 hex chars>. */
export function generateToken(): GeneratedToken {
  const secret = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
  const hash = hashToken(secret);
  const preview = `${TOKEN_PREFIX}${secret.slice(TOKEN_PREFIX.length, TOKEN_PREFIX.length + 4)}…${secret.slice(-4)}`;
  return { secret, hash, preview };
}

/** True if the string looks like an API token (used to skip cheap lookups). */
export function looksLikeApiToken(value: string | null | undefined): boolean {
  return (
    typeof value === 'string' &&
    value.startsWith(TOKEN_PREFIX) &&
    value.length === TOKEN_PREFIX.length + 64
  );
}

export interface VerifiedApiToken {
  id: string;
  name: string;
  readOnly: boolean;
  ownerId: string;
}

/**
 * Verify a bearer token against the ApiToken table.
 * Returns the token + its owner (with role) when valid, null otherwise.
 * Expired and revoked tokens fail closed.
 */
export async function verifyApiToken(secret: string): Promise<
  | (VerifiedApiToken & {
      owner: { id: string; name: string; email: string; role: 'user' | 'admin' };
    })
  | null
> {
  if (!looksLikeApiToken(secret)) return null;

  const hash = hashToken(secret);
  const row = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
    include: {
      owner: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  // Fire-and-forget usage stamp; never block or fail the request over it.
  prisma.apiToken
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch((err) => logger.error('failed to stamp token lastUsedAt', err));

  return {
    id: row.id,
    name: row.name,
    readOnly: row.readOnly,
    ownerId: row.ownerId,
    owner: row.owner,
  };
}

/** Extract a bearer token from request headers, if present. */
export function bearerFromHeaders(headers: Headers): string | null {
  const auth = headers.get('authorization');
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() ?? null;
}

const tokenSelect = {
  id: true,
  name: true,
  preview: true,
  readOnly: true,
  ownerId: true,
  createdAt: true,
  expiresAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

/**
 * Create an API token for `ownerId`. The plaintext is returned exactly once here;
 * only its hash is stored. A token created *through* an existing API token is
 * always read-only, and non-admins always get read-only tokens — a token may only
 * ever mint a token of equal-or-lesser scope.
 */
export async function createApiToken(
  ownerId: string,
  actorId: string,
  input: { name: string; readOnly?: boolean; expiresInDays?: number },
  viaApiToken: boolean,
) {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { role: true },
  });
  if (!owner) throw new Error('Token owner not found');

  const isAdmin = owner.role === 'admin';
  const readOnly = viaApiToken ? true : isAdmin ? (input.readOnly ?? true) : true;

  const { secret, hash, preview } = generateToken();

  const token = await prisma.apiToken.create({
    data: {
      name: input.name,
      tokenHash: hash,
      preview,
      readOnly,
      ownerId,
      expiresAt: input.expiresInDays
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
        : undefined,
    },
    select: tokenSelect,
  });

  await writeAuditLog(actorId, 'token.create', 'ApiToken', token.id, {
    name: token.name,
    readOnly: token.readOnly,
    expiresAt: token.expiresAt,
  });

  return { ...token, token: secret };
}

/** List the caller's own tokens (never the secret or hash). */
export function listMyApiTokens(ownerId: string) {
  return prisma.apiToken.findMany({
    where: { ownerId },
    select: tokenSelect,
    orderBy: { createdAt: 'desc' },
  });
}

/** Admin: list every token with owner info. */
export function listAllApiTokens() {
  return prisma.apiToken.findMany({
    select: {
      ...tokenSelect,
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Revoke a token by id. Owners may revoke their own; admins may revoke any.
 * Idempotent-ish: revoking an already-revoked token succeeds without re-stamping.
 */
export async function revokeApiToken(tokenId: string, actorId: string, actorIsAdmin: boolean) {
  const row = await prisma.apiToken.findUnique({
    where: { id: tokenId },
    select: { id: true, ownerId: true, revokedAt: true, name: true },
  });
  if (!row) throw new Error('Token not found');
  if (!actorIsAdmin && row.ownerId !== actorId) throw new Error('Forbidden');

  if (!row.revokedAt) {
    await prisma.apiToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
    await writeAuditLog(actorId, 'token.revoke', 'ApiToken', tokenId, { name: row.name });
  }

  return prisma.apiToken.findUnique({ where: { id: tokenId }, select: tokenSelect });
}
