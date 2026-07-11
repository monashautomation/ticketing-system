import { prisma } from '@ticketing/db';
import type { CreateTagInput } from '@ticketing/shared';
import { AppError } from '@/lib/errors';

export async function listTags() {
  return prisma.tag.findMany({ orderBy: { name: 'asc' } });
}

/** Callers must gate this behind requireAdmin(). */
export async function createTag(input: CreateTagInput) {
  const existing = await prisma.tag.findUnique({ where: { name: input.name } });
  if (existing) throw new AppError('A tag with that name already exists');
  return prisma.tag.create({ data: { name: input.name, color: input.color } });
}

/** Callers must gate this behind requireAdmin(). */
export async function deleteTag(tagId: string) {
  await prisma.tag.delete({ where: { id: tagId } });
}
