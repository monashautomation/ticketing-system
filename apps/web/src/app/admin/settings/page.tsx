import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { AppHeader } from '@/components/AppHeader';
import { getDiscordSettings } from '@/server/discordSettings';
import { DiscordSettingsForm } from '@/components/DiscordSettingsForm';
import { backLink, page, pageHeader, pageTitle } from '@/lib/styles';

export default async function AdminSettingsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'admin') redirect('/');

  const settings = await getDiscordSettings();

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
        <DiscordSettingsForm
          newTicketChannelId={settings?.newTicketChannelId ?? ''}
          unassignedAlertChannelId={settings?.unassignedAlertChannelId ?? ''}
        />
      </main>
    </>
  );
}
