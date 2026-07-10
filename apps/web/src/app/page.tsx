import Link from 'next/link';
import { getCurrentSession } from '@/lib/session';
import { listTicketsForUser } from '@/server/tickets';
import { SignInButton } from '@/components/SignInButton';
import { NewTicketForm } from '@/components/NewTicketForm';

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 pt-32 text-center">
        <h1 className="text-2xl font-semibold">Support Tickets</h1>
        <p className="text-neutral-500">Sign in to view or open a ticket.</p>
        <SignInButton />
      </main>
    );
  }

  const role = session.user.role as 'user' | 'admin';
  const tickets = await listTicketsForUser(session.user.id, role);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {role === 'admin' ? 'All Tickets' : 'Your Tickets'}
        </h1>
        <Link href="/settings/link-discord" className="text-sm text-neutral-500 hover:underline">
          Link Discord
        </Link>
      </div>

      <NewTicketForm />

      <ul className="mt-8 divide-y divide-neutral-200">
        {tickets.map((ticket) => (
          <li key={ticket.id} className="py-4">
            <Link href={`/t/${ticket.id}`} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{ticket.title}</p>
                <p className="text-sm text-neutral-500">
                  {ticket.createdBy.name}
                  {ticket.assignedTo ? ` · assigned to ${ticket.assignedTo.name}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium uppercase tracking-wide">
                {ticket.status}
              </span>
            </Link>
          </li>
        ))}
        {tickets.length === 0 && <p className="py-4 text-neutral-500">No tickets yet.</p>}
      </ul>
    </main>
  );
}
