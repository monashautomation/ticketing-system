'use client';

import { useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { mutedText } from '@/lib/styles';

interface DiscordClaimRedirectProps {
  callbackURL: string;
}

/** Auto-fires the Authentik sign-in redirect on mount so the Discord link "just works" with one click. */
export function DiscordClaimRedirect({ callbackURL }: DiscordClaimRedirectProps) {
  useEffect(() => {
    authClient.signIn.oauth2({ providerId: 'authentik', callbackURL });
  }, [callbackURL]);

  return <p className={mutedText}>Redirecting you to sign in…</p>;
}
