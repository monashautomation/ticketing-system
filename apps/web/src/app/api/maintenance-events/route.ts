import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/session';
import { createManualMaintenanceEvent, listPublicMaintenanceEvents } from '@/server/maintenance';

const createSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(1).max(2000),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
});

export async function GET() {
  try {
    const events = await listPublicMaintenanceEvents();
    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = createSchema.parse(await request.json());
    const event = await createManualMaintenanceEvent(body);
    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
