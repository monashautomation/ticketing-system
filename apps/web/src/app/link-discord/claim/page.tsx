import { notFound, redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { claimDiscordAccount, previewDiscordClaim } from '@/server/tickets';
import { AppHeader } from '@/components/AppHeader';
import { DiscordClaimRedirect } from '@/components/DiscordClaimRedirect';
import { buttonPrimary, errorText, mutedText, pageNarrow } from '@/lib/styles';

interface ClaimPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function DiscordClaimPage({ searchParams }: ClaimPageProps) {
  const { token } = await searchParams;
  if (!token) notFound();

  const session = await getCurrentSession();

  if (!session) {
    return (
      <>
        <AppHeader />
        <main className={pageNarrow}>
          <h1 className="mb-2 text-xl font-semibold tracking-tight text-text">
            Linking your Discord account
          </h1>
          <DiscordClaimRedirect callbackURL={`/link-discord/claim?token=${token}`} />
        </main>
      </>
    );
  }

  const preview = await previewDiscordClaim(token);
  if (!preview) {
    return (
      <>
        <AppHeader />
        <main className={pageNarrow}>
          <h1 className="mb-2 text-xl font-semibold tracking-tight text-text">
            Couldn&apos;t link your Discord account
          </h1>
          <p className={errorText}>
            This link has expired. Open a new ticket from Discord to get a fresh one.
          </p>
        </main>
      </>
    );
  }

  // Server Action -- browsers only send this as a same-origin POST, so a link shared by whoever
  // holds the claim token can't silently trigger it against a signed-in victim the way a plain
  // GET page-load would. The confirmation step below is the actual point: the user has to
  // recognize the Discord username and agree before anything is written.
  async function confirmClaim() {
    'use server';
    const currentSession = await getCurrentSession();
    if (!currentSession) redirect('/');
    const { ticketId } = await claimDiscordAccount(token!, currentSession.user.id);
    redirect(`/t/${ticketId}`);
  }

  return (
    <>
      <AppHeader />
      <main className={pageNarrow}>
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-text">
          Link your Discord account?
        </h1>
        <p className={`mb-6 ${mutedText}`}>
          Discord user <strong className="text-text">{preview.discordUsername}</strong> opened
          &ldquo;{preview.ticketTitle}&rdquo; and wants to link that Discord account to you. Only
          continue if that Discord user is you.
        </p>
        <form action={confirmClaim}>
          <button type="submit" className={buttonPrimary}>
            Link account and view ticket
          </button>
        </form>
      </main>
    </>
  );
}
