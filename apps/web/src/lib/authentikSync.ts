import { resolveRole } from '@ticketing/shared';
import { prisma } from '@ticketing/db';
import { env } from './env';
import { lookupDirectoryUserByEmail } from './directoryService';
import { logger } from './logger';

interface AuthentikGroup {
  name: string;
}

interface AuthentikUser {
  email: string;
  name: string;
  is_active: boolean;
  groups_obj?: AuthentikGroup[];
}

interface AuthentikUserListResponse {
  pagination: { next: number };
  results: AuthentikUser[];
}

function apiRoot(): string {
  return `${env.authentikIssuer.replace(/\/application\/o\/.*$/, '')}/api/v3/`;
}

async function fetchAuthentikUsersPage(page: number): Promise<AuthentikUserListResponse> {
  const url = new URL('core/users/', apiRoot());
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', '200');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.authentikApiToken}` },
  });
  if (!res.ok) {
    throw new Error(`Authentik user list request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<AuthentikUserListResponse>;
}

async function fetchAllAuthentikUsers(): Promise<AuthentikUser[]> {
  const users: AuthentikUser[] = [];
  let page = 1;
  for (;;) {
    const response = await fetchAuthentikUsersPage(page);
    users.push(...response.results);
    if (!response.pagination.next || response.pagination.next === page) break;
    page = response.pagination.next;
  }
  return users;
}

/** Pulls the full Authentik directory into the local User table so CC/assignee pickers can query it locally. */
export async function syncAuthentikUsers(): Promise<{ upserted: number }> {
  const authentikUsers = await fetchAllAuthentikUsers();
  let upserted = 0;

  for (const authentikUser of authentikUsers) {
    if (!authentikUser.is_active || !authentikUser.email) continue;

    const groupNames = (authentikUser.groups_obj ?? []).map((g) => g.name);
    const role = resolveRole(groupNames, env.adminGroups);

    await prisma.user.upsert({
      where: { email: authentikUser.email },
      create: {
        email: authentikUser.email,
        name: authentikUser.name || authentikUser.email,
        emailVerified: true,
        role,
        authentikGroups: groupNames,
      },
      update: {
        name: authentikUser.name || authentikUser.email,
        role,
        authentikGroups: groupNames,
      },
    });
    upserted += 1;
  }

  await syncTicketGroupMembership();

  return { upserted };
}

/**
 * Recomputes every TicketGroup's `members` from the freshly-synced User.authentikGroups --
 * a user belongs to a TicketGroup iff at least one of their Authentik groups is in that
 * TicketGroup's linked list. Runs after every syncAuthentikUsers pass so membership never
 * drifts more than one sync cycle behind Authentik. `set` (not `connect`) so removals apply.
 */
async function syncTicketGroupMembership(): Promise<void> {
  const [groups, users] = await Promise.all([
    prisma.ticketGroup.findMany({ select: { id: true, authentikGroupNames: true } }),
    prisma.user.findMany({ where: { isDiscordPlaceholder: false }, select: { id: true, authentikGroups: true } }),
  ]);
  if (groups.length === 0) return;

  for (const group of groups) {
    const linked = new Set(group.authentikGroupNames);
    const memberIds = users
      .filter((u) => u.authentikGroups.some((g) => linked.has(g)))
      .map((u) => ({ id: u.id }));

    await prisma.ticketGroup.update({
      where: { id: group.id },
      data: { members: { set: memberIds } },
    });
  }
}

interface AuthentikGroupListResponse {
  pagination: { next: number };
  results: { name: string }[];
}

/** Full list of Authentik group names, for the TicketGroup settings picker. */
export async function fetchAuthentikGroupNames(): Promise<string[]> {
  const names: string[] = [];
  let page = 1;
  for (;;) {
    const url = new URL('core/groups/', apiRoot());
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', '200');
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${env.authentikApiToken}` },
    });
    if (!res.ok) {
      throw new Error(`Authentik group list request failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as AuthentikGroupListResponse;
    names.push(...body.results.map((g) => g.name));
    if (!body.pagination.next || body.pagination.next === page) break;
    page = body.pagination.next;
  }
  return names;
}

/**
 * Hourly sweep: refreshes every real (non-placeholder) user's `discordId` from directory-service
 * by email, overwriting on drift -- directory-service is the source of truth for Discord linkage,
 * not this table. Runs on its own cadence, decoupled from syncAuthentikUsers's 15-min loop
 * (directory-service has no bulk-list endpoint, so this is one HTTP call per user regardless).
 * Placeholder users are skipped -- their email is a synthetic `discord-{id}@placeholder.invalid`
 * that will never match a directory-service record.
 */
export async function refreshDiscordIdsFromDirectory(): Promise<{ checked: number; updated: number }> {
  const users = await prisma.user.findMany({
    where: { isDiscordPlaceholder: false },
    select: { id: true, email: true, discordId: true },
  });

  let updated = 0;
  for (const user of users) {
    const directoryUser = await lookupDirectoryUserByEmail(user.email);
    const newDiscordId = directoryUser?.discordUserId ?? null;
    if (newDiscordId === user.discordId) continue;

    try {
      await prisma.user.update({ where: { id: user.id }, data: { discordId: newDiscordId } });
      updated += 1;
    } catch (error) {
      // Most likely a unique-constraint clash (another row already holds newDiscordId, e.g.
      // stale data) -- log and move on rather than aborting the whole sweep over one user.
      logger.error(`Failed to update discordId for user ${user.id}`, error);
    }
  }

  return { checked: users.length, updated };
}
