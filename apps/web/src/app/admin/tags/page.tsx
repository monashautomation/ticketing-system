import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { listTags } from '@/server/tags';
import { TagManager } from '@/components/TagManager';

export default async function AdminTagsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== 'admin') redirect('/');

  const tags = await listTags();

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ticket Tags</h1>
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          Back to queue
        </Link>
      </div>
      <TagManager tags={tags} />
    </main>
  );
}
