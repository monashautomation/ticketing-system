import { prisma } from '@ticketing/db';
import { requireSession } from '@/lib/session';
import { ForbiddenError } from '@/lib/errors';
import { canViewTicket, getTicketOr404, verifyTicketToken } from '@/server/tickets';
import { subscribeToTicket } from '@/server/ticket-events';
import { handleApiError } from '@/lib/api-errors';

export const dynamic = 'force-dynamic';

// The web app runs multiple replicas (see deploy/base/web-deployment.yaml), but
// ticket-events.ts is a single-process EventEmitter — a PATCH handled by one pod
// never reaches an SSE connection held open on another. Poll the DB as a fallback
// so updates (e.g. close/resolve system messages) always reach viewers regardless
// of which pod served which request.
const POLL_INTERVAL_MS = 3000;

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

        let lastMessageId: string | null = null;
        const poll = async () => {
          try {
            const latest = await prisma.ticketMessage.findFirst({
              where: { ticketId: id },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            });
            if (latest && latest.id !== lastMessageId) {
              if (lastMessageId !== null) send({ type: 'message', ticketId: id, messageId: latest.id });
              lastMessageId = latest.id;
            }
          } catch {
            // Transient DB errors shouldn't kill the connection; skip this tick.
          }
        };
        void poll();
        const pollTimer = setInterval(poll, POLL_INTERVAL_MS);

        const heartbeat = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), 25000);

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          clearInterval(pollTimer);
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
