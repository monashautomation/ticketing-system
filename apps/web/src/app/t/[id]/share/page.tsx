import { notFound, redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { previewTicketShareLink, redeemTicketShareLink } from '@/server/tickets';
import { AppHeader } from '@/components/AppHeader';
import { DiscordClaimRedirect } from '@/components/DiscordClaimRedirect';
import { errorText, pageNarrow } from '@/lib/styles';

interface SharePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function TicketSharePage({ params, searchParams }: SharePageProps) {
  const { id } = await params;
  const { token } = await searchParams;
  if (!token) notFound();

  const session = await getCurrentSession();

  if (!session) {
    return (
      <>
        <AppHeader />
        <main className={pageNarrow}>
          <h1 className="mb-2 text-xl font-semibold tracking-tight text-text">Opening shared ticket</h1>
          <DiscordClaimRedirect callbackURL={`/t/${id}/share?token=${token}`} />
        </main>
      </>
    );
  }

  const preview = await previewTicketShareLink(token, id);
  if (!preview) {
    return (
      <>
        <AppHeader />
        <main className={pageNarrow}>
          <h1 className="mb-2 text-xl font-semibold tracking-tight text-text">
            Couldn&apos;t open this link
          </h1>
          <p className={errorText}>
            This share link has expired. Ask the ticket owner to share it again.
          </p>
        </main>
      </>
    );
  }

  await redeemTicketShareLink(token, id, session.user.id);
  redirect(`/t/${id}`);
}
