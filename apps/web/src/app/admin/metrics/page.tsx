import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { AppHeader } from '@/components/AppHeader';
import { getTicketMetrics } from '@/server/tickets';
import {
  backLink,
  card,
  page,
  pageHeader,
  pageTitle,
  table,
  tableCell,
  tableHead,
  tableHeadCell,
  tableRowDivider,
  tableWrap,
} from '@/lib/styles';

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
    { label: 'In Progress', value: metrics.totalInProgress },
    { label: 'Resolved', value: metrics.totalResolved },
    { label: 'Closed', value: metrics.totalClosed },
    { label: 'Overdue', value: metrics.overdueCount, danger: metrics.overdueCount > 0 },
  ];

  return (
    <>
      <AppHeader />
      <main className={page}>
        <div className={pageHeader}>
          <h1 className={pageTitle}>Ticket Metrics</h1>
          <Link href="/admin" className={backLink}>
            Back to queue
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <div key={c.label} className={card}>
              <p className="text-sm text-text-secondary">{c.label}</p>
              <p className={`text-3xl font-semibold ${c.danger ? 'text-danger' : 'text-text'}`}>{c.value}</p>
            </div>
          ))}
          <div className={card}>
            <p className="text-sm text-text-secondary">Avg. resolution time</p>
            <p className="text-3xl font-semibold text-text">{formatDuration(metrics.avgResolutionMs)}</p>
          </div>
        </div>

        <h2 className="mb-3 text-lg font-medium text-text">By priority</h2>
        <div className={tableWrap}>
          <table className={table}>
            <thead className={tableHead}>
              <tr>
                <th className={tableHeadCell}>Priority</th>
                <th className={tableHeadCell}>Count</th>
              </tr>
            </thead>
            <tbody className={tableRowDivider}>
              {Object.entries(metrics.byPriority).map(([priority, count]) => (
                <tr key={priority}>
                  <td className={`${tableCell} capitalize text-text`}>{priority}</td>
                  <td className={`${tableCell} text-text`}>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
