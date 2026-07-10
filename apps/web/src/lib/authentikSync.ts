import { resolveRole } from '@ticketing/shared';
import { prisma } from '@ticketing/db';
import { env } from './env';

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
      },
      update: {
        name: authentikUser.name || authentikUser.email,
        role,
      },
    });
    upserted += 1;
  }

  return { upserted };
}
