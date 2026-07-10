import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { getTicketMetrics } from '@/server/tickets';

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export const dynamic = 'force-dynamic';

export default async function AdminMetricsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'admin') redirect('/');

  const metrics = await getTicketMetrics();

  const cards = [
    { label: 'Open', value: metrics.totalOpen },
    { label: 'Pending', value: metrics.totalPending },
    { label: 'Escalated', value: metrics.totalEscalated },
    { label: 'Resolved', value: metrics.totalResolved },
    { label: 'Closed', value: metrics.totalClosed },
    { label: 'Overdue', value: metrics.overdueCount, danger: metrics.overdueCount > 0 },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ticket Metrics</h1>
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          Back to queue
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-neutral-200 p-4">
            <p className="text-sm text-neutral-500">{card.label}</p>
            <p className={`text-3xl font-semibold ${card.danger ? 'text-red-700' : ''}`}>{card.value}</p>
          </div>
        ))}
        <div className="rounded-lg border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500">Avg. resolution time</p>
          <p className="text-3xl font-semibold">{formatDuration(metrics.avgResolutionMs)}</p>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-medium">By priority</h2>
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Count</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {Object.entries(metrics.byPriority).map(([priority, count]) => (
              <tr key={priority}>
                <td className="px-4 py-2 capitalize">{priority}</td>
                <td className="px-4 py-2">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
