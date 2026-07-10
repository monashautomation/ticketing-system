import { NextResponse } from 'next/server';
import { prisma } from '@ticketing/db';

export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ success: true, data: { status: 'ok' } });
}
