'use client';

import { LogIn } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { buttonPrimary, buttonPrimaryLg } from '@/lib/styles';

export function SignInButton({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const onClick = () =>
    authClient.signIn.oauth2({
      providerId: 'authentik',
      callbackURL: '/',
    });

  if (size === 'lg') {
    return (
      <button className={buttonPrimaryLg} onClick={onClick}>
        <LogIn className="h-4 w-4" />
        Sign in with Authentik
      </button>
    );
  }

  return (
    <button className={buttonPrimary} onClick={onClick}>
      Sign in with Authentik
    </button>
  );
}
