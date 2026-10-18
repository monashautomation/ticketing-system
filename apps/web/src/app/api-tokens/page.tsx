import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/session';
import { AppHeader } from '@/components/AppHeader';
import { ApiTokenManager } from '@/components/ApiTokenManager';
import { backLink, mutedText, page, pageHeader, pageTitle } from '@/lib/styles';

export default async function ApiTokensPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/');

  const isAdmin = session.user.role === 'admin';

  return (
    <>
      <AppHeader />
      <main className={page}>
        <div className={pageHeader}>
          <h1 className={pageTitle}>API Tokens</h1>
          <Link href="/" className={backLink}>
            Back to tickets
          </Link>
        </div>
        <p className={`mb-6 ${mutedText}`}>
          Bearer tokens for the <code>maticket</code> CLI and the REST API. Create a token here,
          then run <code>maticket auth login</code> and paste it. Tokens are stored hashed; the
          secret is shown exactly once. Read-only tokens can list and view tickets; read &amp;
          write tokens can also create, update, comment, and upload.
        </p>
        <ApiTokenManager isAdmin={isAdmin} />
      </main>
    </>
  );
}
