import { listPublicMaintenanceEvents } from '@/server/maintenance';
import { AppHeader } from '@/components/AppHeader';
import { badgeSuccess, badgeWarning, card, mutedText, page } from '@/lib/styles';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'Ongoing',
  resolved: 'Resolved',
};

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const events = await listPublicMaintenanceEvents();

  return (
    <>
      <AppHeader />
      <main className={page}>
        <h1 className="mb-8 text-2xl font-semibold tracking-tight text-text">System Status</h1>
        <ul className="flex flex-col gap-4">
          {events.map((event) => (
            <li key={event.id} className={card}>
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium text-text">{event.title}</p>
                <span className={event.status === 'resolved' ? badgeSuccess : badgeWarning}>
                  {STATUS_LABEL[event.status]}
                </span>
              </div>
              <p className="text-sm text-text-secondary">{event.body}</p>
              <p className="mt-2 text-xs text-text-tertiary">
                {event.startAt.toLocaleString()}
                {event.endAt ? ` – ${event.endAt.toLocaleString()}` : ''}
              </p>
            </li>
          ))}
          {events.length === 0 && <p className={mutedText}>No incidents to report.</p>}
        </ul>
      </main>
    </>
  );
}
