import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { genericOAuth } from 'better-auth/plugins';
import { resolveRole } from '@ticketing/shared';
import { prisma } from '@ticketing/db';
import { env } from './env';

// Authentik userinfo includes a `groups` claim when the "ticketing" OIDC
// provider/application in Authentik has the groups scope mapping enabled.
interface AuthentikProfile {
  sub: string;
  email: string;
  name?: string;
  preferred_username?: string;
  picture?: string;
  groups?: string[];
}

export const auth = betterAuth({
  secret: env.betterAuthSecret,
  baseURL: env.betterAuthUrl,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
      discordId: { type: 'string', required: false, input: false },
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'authentik',
          discoveryUrl: `${env.authentikIssuer.replace(/\/$/, '')}/.well-known/openid-configuration`,
          clientId: env.authentikClientId,
          clientSecret: env.authentikClientSecret,
          scopes: ['openid', 'profile', 'email', 'groups'],
          mapProfileToUser: (raw: Record<string, unknown>) => {
            const profile = raw as unknown as AuthentikProfile;
            return {
              email: profile.email,
              name: profile.name ?? profile.preferred_username ?? profile.email,
              image: profile.picture,
              role: resolveRole(profile.groups ?? [], env.adminGroups),
            };
          },
        },
      ],
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh once per day
  },
});

export type Session = typeof auth.$Infer.Session;
