import type { UserRole } from './types';

/** Maps Authentik group claims to an app role. Admin wins if any group matches. */
export function resolveRole(userGroups: string[], adminGroups: string[]): UserRole {
  const adminSet = new Set(adminGroups);
  return userGroups.some((g) => adminSet.has(g)) ? 'admin' : 'user';
}
