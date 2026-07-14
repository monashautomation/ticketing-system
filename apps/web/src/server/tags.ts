import { prisma } from '@ticketing/db';
import type { CreateTagInput } from '@ticketing/shared';
import { AppError } from '@/lib/errors';
import { writeAuditLog } from '@/server/audit';

export async function listTags() {
  return prisma.tag.findMany({ orderBy: { name: 'asc' } });
}

/** Callers must gate this behind requireAdmin(). */
export async function createTag(input: CreateTagInput, actorId: string) {
  const existing = await prisma.tag.findUnique({ where: { name: input.name } });
  if (existing) throw new AppError('A tag with that name already exists');
  const tag = await prisma.tag.create({ data: { name: input.name, color: input.color } });
  await writeAuditLog(actorId, 'tag.create', 'Tag', tag.id, { name: tag.name, color: tag.color });
  return tag;
}

/** Callers must gate this behind requireAdmin(). */
export async function deleteTag(tagId: string, actorId: string) {
  const tag = await prisma.tag.delete({ where: { id: tagId } });
  await writeAuditLog(actorId, 'tag.delete', 'Tag', tagId, { name: tag.name });
}
