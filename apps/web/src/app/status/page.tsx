import { listPublicMaintenanceEvents } from '@/server/maintenance';

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'Ongoing',
  resolved: 'Resolved',
};

export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const events = await listPublicMaintenanceEvents();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-8 text-2xl font-semibold">System Status</h1>
      <ul className="flex flex-col gap-4">
        {events.map((event) => (
          <li key={event.id} className="rounded-lg border border-neutral-200 p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="font-medium">{event.title}</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${
                  event.status === 'resolved'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {STATUS_LABEL[event.status]}
              </span>
            </div>
            <p className="text-sm text-neutral-600">{event.body}</p>
            <p className="mt-2 text-xs text-neutral-400">
              {event.startAt.toLocaleString()}
              {event.endAt ? ` – ${event.endAt.toLocaleString()}` : ''}
            </p>
          </li>
        ))}
        {events.length === 0 && <p className="text-neutral-500">No incidents to report.</p>}
      </ul>
    </main>
  );
}
