import { NextResponse } from 'next/server';
import { prisma } from '@ticketing/db';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/session';

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const role = url.searchParams.get('role');

    const users = await prisma.user.findMany({
      where: role ? { role: role as 'user' | 'admin' } : undefined,
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    return handleApiError(error);
  }
}
