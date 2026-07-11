'use client';

import { authClient } from '@/lib/auth-client';
import { buttonPrimary } from '@/lib/styles';

export function SignInButton() {
  return (
    <button
      className={buttonPrimary}
      onClick={() =>
        authClient.signIn.oauth2({
          providerId: 'authentik',
          callbackURL: '/',
        })
      }
    >
      Sign in with Authentik
    </button>
  );
}
