import { requireSession } from '@/lib/session';
import { ForbiddenError } from '@/lib/errors';
import { canViewTicket, getTicketOr404, verifyTicketToken } from '@/server/tickets';
import { subscribeToTicket } from '@/server/ticket-events';
import { handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ticket = await getTicketOr404(id);

    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    if (!token || !(await verifyTicketToken(id, token))) {
      const session = await requireSession();
      const user = { id: session.user.id, role: session.user.role as 'user' | 'admin' };
      if (!canViewTicket(ticket, user)) throw new ForbiddenError();
    }

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        send({ type: 'connected' });
        const unsubscribe = subscribeToTicket(id, (event) => send({ type: 'message', ...event }));

        const heartbeat = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), 25000);

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          unsubscribe();
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
