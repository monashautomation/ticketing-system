import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@ticketing/db';
import { resetDatabase, createTestUser } from '@/test/db';
import {
  bearerFromHeaders,
  createApiToken,
  generateToken,
  hashToken,
  listAllApiTokens,
  listMyApiTokens,
  looksLikeApiToken,
  revokeApiToken,
  verifyApiToken,
} from './apiTokens';

beforeEach(async () => {
  await resetDatabase();
});

describe('token format', () => {
  it('generated tokens look like tokens and hash deterministically', () => {
    const t = generateToken();
    expect(t.secret).toMatch(/^matk_[0-9a-f]{64}$/);
    expect(hashToken(t.secret)).toBe(t.hash);
    expect(looksLikeApiToken(t.secret)).toBe(true);
    expect(looksLikeApiToken('matk_short')).toBe(false);
    expect(looksLikeApiToken(null)).toBe(false);
  });

  it('bearerFromHeaders parses Authorization: Bearer', () => {
    const h = new Headers({ authorization: 'Bearer matk_abc' });
    expect(bearerFromHeaders(h)).toBe('matk_abc');
    expect(bearerFromHeaders(new Headers())).toBeNull();
  });
});

describe('create + verify', () => {
  it('creates a token, verifies it, and stamps lastUsedAt', async () => {
    const user = await createTestUser({ name: 'Token Owner' });
    const created = await createApiToken(user.id, user.id, { name: 'cli' }, false);

    expect(created.token).toMatch(/^matk_[0-9a-f]{64}$/);
    expect(created.readOnly).toBe(true);

    const verified = await verifyApiToken(created.token);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(created.id);
    expect(verified?.owner.id).toBe(user.id);
    expect(verified?.readOnly).toBe(true);

    // lastUsedAt is stamped fire-and-forget; give it a tick.
    await new Promise((r) => setTimeout(r, 50));
    const row = await prisma.apiToken.findUnique({ where: { id: created.id } });
    expect(row?.lastUsedAt).toBeInstanceOf(Date);
  });

  it('stores only the hash, never the secret', async () => {
    const user = await createTestUser();
    const created = await createApiToken(user.id, user.id, { name: 'cli' }, false);
    const raw = await prisma.$queryRaw<{ tokenHash: string; preview: string }[]>`
      SELECT "tokenHash", preview FROM "api_tokens" WHERE id = ${created.id}
    `;
    expect(raw[0]?.tokenHash).toBe(hashToken(created.token));
    expect(raw[0]?.preview).not.toContain(created.token.slice(5, 25));
  });

  it('rejects unknown, revoked, and expired tokens', async () => {
    const user = await createTestUser();
    const created = await createApiToken(user.id, user.id, { name: 'cli' }, false);

    expect(await verifyApiToken('matk_' + '0'.repeat(64))).toBeNull();

    const expired = await createApiToken(
      user.id, user.id, { name: 'old', expiresInDays: 1 }, false,
    );
    await prisma.apiToken.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await verifyApiToken(expired.token)).toBeNull();

    await revokeApiToken(created.id, user.id, false);
    expect(await verifyApiToken(created.token)).toBeNull();
  });

  it('a token minted through an existing token is forced read-only', async () => {
    const admin = await createTestUser({ name: 'Admin', role: 'admin' });
    const created = await createApiToken(admin.id, admin.id, { name: 'rw', readOnly: false }, false);
    expect(created.readOnly).toBe(false);

    const derived = await createApiToken(admin.id, admin.id, { name: 'derived', readOnly: false }, true);
    expect(derived.readOnly).toBe(true);
  });

  it('non-admins always get read-only tokens', async () => {
    const user = await createTestUser({ role: 'user' });
    const created = await createApiToken(user.id, user.id, { name: 'rw?', readOnly: false }, false);
    expect(created.readOnly).toBe(true);
  });
});

describe('revoke + list', () => {
  it('owners revoke their own; admins revoke anyone; others get an error', async () => {
    const owner = await createTestUser({ name: 'Owner' });
    const other = await createTestUser({ name: 'Other' });
    const admin = await createTestUser({ name: 'Admin', role: 'admin' });

    const t = await createApiToken(owner.id, owner.id, { name: 'cli' }, false);

    await expect(revokeApiToken(t.id, other.id, false)).rejects.toThrow('Forbidden');

    const revokedByAdmin = await revokeApiToken(t.id, admin.id, true);
    expect(revokedByAdmin?.revokedAt).toBeInstanceOf(Date);

    // idempotent
    const again = await revokeApiToken(t.id, owner.id, false);
    expect(again?.revokedAt).toBeInstanceOf(Date);
  });

  it('lists never expose the secret or hash', async () => {
    const user = await createTestUser();
    const created = await createApiToken(user.id, user.id, { name: 'cli' }, false);

    const mine = await listMyApiTokens(user.id);
    expect(mine).toHaveLength(1);
    expect(JSON.stringify(mine)).not.toContain(created.token);
    expect(JSON.stringify(mine)).not.toContain(hashToken(created.token));

    const all = await listAllApiTokens();
    expect(all).toHaveLength(1);
    expect(all[0]?.owner?.id).toBe(user.id);
  });

  it('revoking a token writes an audit entry', async () => {
    const user = await createTestUser();
    const created = await createApiToken(user.id, user.id, { name: 'cli' }, false);
    await revokeApiToken(created.id, user.id, false);

    const entries = await prisma.auditLog.findMany({
      where: { targetType: 'ApiToken', targetId: created.id },
    });
    const actions = entries.map((e) => e.action);
    expect(actions).toContain('token.create');
    expect(actions).toContain('token.revoke');
  });
});
