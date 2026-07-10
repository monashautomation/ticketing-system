import { resolveRole } from '@ticketing/shared';

export function collectGroupNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry === 'string') return [entry];
    if (!entry || typeof entry !== 'object') return [];

    const candidate =
      ('name' in entry && entry.name) ||
      ('slug' in entry && entry.slug) ||
      ('path' in entry && entry.path) ||
      ('value' in entry && entry.value) ||
      ('group' in entry && entry.group);

    return typeof candidate === 'string' ? [candidate] : [];
  });
}

function collectGroupsFromValue(value: unknown, seen: Set<object>): string[] {
  if (!value || typeof value !== 'object') return [];

  if (seen.has(value)) return [];
  seen.add(value);

  const record = value as Record<string, unknown>;
  const candidates = [record.groups, record.group_names, record.memberOf, record.roles];
  const directGroups = candidates.flatMap(collectGroupNames).filter(Boolean);
  if (directGroups.length > 0) return [...new Set(directGroups)];

  return Object.values(record).flatMap((entry) => collectGroupsFromValue(entry, seen));
}

export function extractProviderGroups(accountInfoData: unknown): string[] {
  if (!accountInfoData || typeof accountInfoData !== 'object') return [];

  const record = accountInfoData as Record<string, unknown>;
  const candidates = [record, record.data];
  return [...new Set(candidates.flatMap((entry) => collectGroupsFromValue(entry, new Set())))];
}

export function resolveSessionRole(
  accountInfoData: unknown,
  adminGroups: string[],
): 'user' | 'admin' {
  const providerGroups = extractProviderGroups(accountInfoData);
  if (providerGroups.length === 0) return 'user';

  return resolveRole(providerGroups, adminGroups);
}