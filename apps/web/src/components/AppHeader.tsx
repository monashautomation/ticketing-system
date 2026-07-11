import Image from 'next/image';
import Link from 'next/link';
import { BarChart3, Inbox, Tag as TagIcon, Ticket } from 'lucide-react';
import { getCurrentSession } from '@/lib/session';
import { SignInButton } from '@/components/SignInButton';
import { LogoutButton } from '@/components/LogoutButton';
import { NotificationBell } from '@/components/NotificationBell';
import {
  avatarCircle,
  avatarName,
  headerAccount,
  headerBar,
  headerInner,
  headerLogo,
  headerNav,
  navLink,
} from '@/lib/styles';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`;
}

export async function AppHeader() {
  const session = await getCurrentSession();
  const role = session?.user.role as 'user' | 'admin' | undefined;

  return (
    <header className={headerBar}>
      <div className={headerInner}>
        <Link href="/" className={headerLogo}>
          <Image
            src="/branding/logo-horizontal.png"
            alt="Monash Automation"
            width={160}
            height={34}
            priority
            className="h-7 w-auto"
          />
        </Link>

        {session && (
          <nav className={headerNav}>
            <Link href="/" className={`${navLink} inline-flex items-center gap-1.5`}>
              <Ticket className="h-4 w-4" />
              My Tickets
            </Link>
            {role === 'admin' && (
              <>
                <Link href="/admin" className={`${navLink} inline-flex items-center gap-1.5`}>
                  <Inbox className="h-4 w-4" />
                  Admin Queue
                </Link>
                <Link href="/admin/metrics" className={`${navLink} inline-flex items-center gap-1.5`}>
                  <BarChart3 className="h-4 w-4" />
                  Metrics
                </Link>
                <Link href="/admin/tags" className={`${navLink} inline-flex items-center gap-1.5`}>
                  <TagIcon className="h-4 w-4" />
                  Tags
                </Link>
              </>
            )}
          </nav>
        )}

        <div className={headerAccount}>
          {session ? (
            <>
              <NotificationBell />
              <span className={`${avatarCircle} transition-transform hover:scale-105`}>
                {initials(session.user.name)}
              </span>
              <span className={avatarName}>{session.user.name}</span>
              <LogoutButton />
            </>
          ) : (
            <SignInButton />
          )}
        </div>
      </div>
    </header>
  );
}
