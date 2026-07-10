import { randomInt } from 'node:crypto';
import { prisma } from '@ticketing/db';
import { AppError } from '@/lib/errors';

const LINK_CODE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function generateCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

export async function createLinkCode(userId: string) {
  await prisma.discordLinkCode.deleteMany({ where: { userId } });
  return prisma.discordLinkCode.create({
    data: {
      userId,
      code: generateCode(),
      expiresAt: new Date(Date.now() + LINK_CODE_TTL_MS),
    },
  });
}

export async function redeemLinkCode(code: string, discordId: string) {
  const record = await prisma.discordLinkCode.findUnique({ where: { code } });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError('Invalid or expired code');
  }

  const existingLink = await prisma.user.findUnique({ where: { discordId } });
  if (existingLink && existingLink.id !== record.userId) {
    throw new AppError('This Discord account is already linked to another user');
  }

  const user = await prisma.user.update({
    where: { id: record.userId },
    data: { discordId },
  });
  await prisma.discordLinkCode.delete({ where: { id: record.id } });

  return user;
}
