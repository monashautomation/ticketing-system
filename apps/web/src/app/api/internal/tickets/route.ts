import { NextResponse } from 'next/server';
import { createInternalTicketSchema } from '@ticketing/shared';
import { handleApiError } from '@/lib/api-errors';
import { requireInternalSecret } from '@/lib/internal-auth';
import { createTicketFromDiscord } from '@/server/tickets';
import { env } from '@/lib/env';

export async function POST(request: Request) {
  try {
    requireInternalSecret(request);
    const body = createInternalTicketSchema.parse(await request.json());
    const { ticket, path, isNewUser } = await createTicketFromDiscord(body);

    return NextResponse.json({
      success: true,
      data: { ticketId: ticket.id, isNewUser, url: `${env.publicAppUrl}${path}` },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
