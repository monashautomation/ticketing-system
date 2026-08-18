import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { AppHeader } from '@/components/AppHeader';
import { listTicketGroups } from '@/server/ticketGroups';
import { fetchAuthentikGroupNames } from '@/lib/authentikSync';
import { TicketGroupsManager } from '@/components/TicketGroupsManager';
import { backLink, mutedText, page, pageHeader, pageTitle } from '@/lib/styles';

export default async function AdminTicketGroupsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'admin') redirect('/');

  const [groups, authentikGroupNames] = await Promise.all([
    listTicketGroups(),
    fetchAuthentikGroupNames().catch(() => []),
  ]);

  return (
    <>
      <AppHeader />
      <main className={page}>
        <div className={pageHeader}>
          <h1 className={pageTitle}>Ticket Groups</h1>
          <Link href="/admin" className={backLink}>
            Back to queue
          </Link>
        </div>
        <p className={`mb-6 ${mutedText}`}>
          Groups route tickets to specific teams. Membership is derived from the linked Authentik groups and
          refreshes automatically (~every 15 minutes).
        </p>
        <TicketGroupsManager initialGroups={groups} authentikGroupNames={authentikGroupNames} />
      </main>
    </>
  );
}
