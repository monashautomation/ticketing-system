import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { LinkDiscordCard } from '@/components/LinkDiscordCard';

export default async function LinkDiscordPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/');

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="mb-2 text-xl font-semibold">Link your Discord account</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {session.user.discordId
          ? 'Your account is already linked.'
          : 'Generate a code, then run /link <code> in Discord to connect your account.'}
      </p>
      {!session.user.discordId && <LinkDiscordCard />}
    </main>
  );
}
