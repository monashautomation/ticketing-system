import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { AppHeader } from '@/components/AppHeader';
import { listTags } from '@/server/tags';
import { TagManager } from '@/components/TagManager';
import { backLink, page, pageHeader, pageTitle } from '@/lib/styles';

export default async function AdminTagsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'admin') redirect('/');

  const tags = await listTags();

  return (
    <>
      <AppHeader />
      <main className={page}>
        <div className={pageHeader}>
          <h1 className={pageTitle}>Ticket Tags</h1>
          <Link href="/admin" className={backLink}>
            Back to queue
          </Link>
        </div>
        <TagManager tags={tags} />
      </main>
    </>
  );
}
