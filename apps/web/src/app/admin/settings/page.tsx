import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { AppHeader } from '@/components/AppHeader';
import { getDiscordSettings } from '@/server/discordSettings';
import { listTicketGroups } from '@/server/ticketGroups';
import { fetchAuthentikGroupNames } from '@/lib/authentikSync';
import { DiscordSettingsForm } from '@/components/DiscordSettingsForm';
import { TicketGroupsManager } from '@/components/TicketGroupsManager';
import { backLink, mutedText, page, pageHeader, pageTitle } from '@/lib/styles';

export default async function AdminSettingsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'admin') redirect('/');

  const [settings, groups, authentikGroupNames] = await Promise.all([
    getDiscordSettings(),
    listTicketGroups(),
    fetchAuthentikGroupNames().catch(() => []),
  ]);

  return (
    <>
      <AppHeader />
      <main className={page}>
        <div className={pageHeader}>
          <h1 className={pageTitle}>Discord Notification Settings</h1>
          <Link href="/admin" className={backLink}>
            Back to queue
          </Link>
        </div>
        <p className={`mb-2 ${mutedText}`}>
          Admin channel -- used for tickets marked &quot;unsure&quot; (routed to admins only, not to any group).
        </p>
        <DiscordSettingsForm
          newTicketChannelId={settings?.newTicketChannelId ?? ''}
          unassignedAlertChannelId={settings?.unassignedAlertChannelId ?? ''}
        />

        <h2 className={`mt-10 mb-2 ${pageTitle} text-lg`}>Ticket Groups</h2>
        <p className={`mb-4 ${mutedText}`}>
          Groups route tickets to specific teams. Membership is derived from the linked Authentik groups and
          refreshes automatically (~every 15 minutes).
        </p>
        <TicketGroupsManager initialGroups={groups} authentikGroupNames={authentikGroupNames} />
      </main>
    </>
  );
}
