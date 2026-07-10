import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@ticketing/db';
import { resetDatabase, createTestUser } from '@/test/db';
import { createLinkCode, redeemLinkCode } from './discord-link';

beforeEach(async () => {
  await resetDatabase();
});

describe('createLinkCode + redeemLinkCode', () => {
  it('links the requesting user to the given discordId', async () => {
    const user = await createTestUser();
    const linkCode = await createLinkCode(user.id);

    const linked = await redeemLinkCode(linkCode.code, 'discord-789');

    expect(linked.discordId).toBe('discord-789');
  });

  it('replaces a stale unused code when a new one is generated', async () => {
    const user = await createTestUser();
    const first = await createLinkCode(user.id);
    const second = await createLinkCode(user.id);

    expect(first.code).not.toBe(second.code);
    await expect(redeemLinkCode(first.code, 'discord-x')).rejects.toThrow('Invalid or expired code');
  });

  it('rejects an expired code', async () => {
    const user = await createTestUser();
    const linkCode = await createLinkCode(user.id);
    await prisma.discordLinkCode.update({
      where: { id: linkCode.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(redeemLinkCode(linkCode.code, 'discord-expired')).rejects.toThrow(
      'Invalid or expired code',
    );
  });

  it('rejects redeeming onto a discordId already linked to a different user', async () => {
    await createTestUser({ name: 'First', discordId: 'discord-taken' });
    const secondUser = await createTestUser({ name: 'Second', email: 'second@test.local' });
    const linkCode = await createLinkCode(secondUser.id);

    await expect(redeemLinkCode(linkCode.code, 'discord-taken')).rejects.toThrow(
      'already linked to another user',
    );
  });

  it('is idempotent when re-linking the same user to the same discordId', async () => {
    const user = await createTestUser({ discordId: 'discord-same' });
    const linkCode = await createLinkCode(user.id);

    const relinked = await redeemLinkCode(linkCode.code, 'discord-same');
    expect(relinked.discordId).toBe('discord-same');
  });

  it('deletes the code after successful redemption so it cannot be reused', async () => {
    const user = await createTestUser();
    const linkCode = await createLinkCode(user.id);

    await redeemLinkCode(linkCode.code, 'discord-once');
    await expect(redeemLinkCode(linkCode.code, 'discord-twice')).rejects.toThrow(
      'Invalid or expired code',
    );
  });
});
