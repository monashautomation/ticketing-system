import { logger } from './logger';

/** Subset of directory-service's serializeFullUser() response that we actually use. */
export interface DirectoryUser {
  id: string;
  email: string;
  name: string;
  discordUserId: string | null;
  discordUsername: string | null;
}

interface DirectoryUsersResponse {
  users: DirectoryUser[];
}

async function directoryFetch(path: string, params: Record<string, string>): Promise<DirectoryUsersResponse | null> {
  // Deferred import: keeps env.ts's required-var validation out of the module load path for
  // pure-function unit tests that import this module transitively but never call it.
  const { env } = await import('./env');
  const url = new URL(`/api/v1/users`, env.directoryServiceApiUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.directoryServiceApiKey}` },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`directory-service request to ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<DirectoryUsersResponse>;
}

/** Looks up a directory-service user by email. Used by the hourly discordId refresh sweep. */
export async function lookupDirectoryUserByEmail(email: string): Promise<DirectoryUser | null> {
  try {
    const result = await directoryFetch('/api/v1/users', { email });
    return result?.users[0] ?? null;
  } catch (error) {
    logger.error('directory-service lookup by email failed', error);
    return null;
  }
}

/**
 * Looks up a directory-service user by Discord username. Used by createTicketFromDiscord to
 * resolve an org member directly, skipping the placeholder/claim flow.
 *
 * Confirmed against directory-service's own source (apps/web/src/app/api/v1/users/route.ts):
 * the filter param is `discordName`, and it's a case-insensitive *partial* match (`contains`),
 * not exact -- e.g. `?discordName=sam` also matches a user named `samantha`. Filtering the
 * results down to an exact (case-insensitive) match here to avoid silently linking a ticket to
 * the wrong person when usernames overlap as substrings.
 */
export async function lookupDirectoryUserByDiscordUsername(discordUsername: string): Promise<DirectoryUser | null> {
  try {
    const result = await directoryFetch('/api/v1/users', { discordName: discordUsername });
    return (
      result?.users.find((u) => u.discordUsername?.toLowerCase() === discordUsername.toLowerCase()) ?? null
    );
  } catch (error) {
    logger.error('directory-service lookup by discord username failed', error);
    return null;
  }
}
