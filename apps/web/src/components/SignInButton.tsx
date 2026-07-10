'use client';

import { authClient } from '@/lib/auth-client';

export function SignInButton() {
  return (
    <button
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
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
