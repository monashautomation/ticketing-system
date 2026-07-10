import { describe, expect, it } from 'vitest';
import { extractProviderGroups, resolveSessionRole } from './role';

describe('extractProviderGroups', () => {
  it('returns string groups as-is', () => {
    expect(extractProviderGroups({ groups: ['infrastructure', 'engineering'] })).toEqual([
      'infrastructure',
      'engineering',
    ]);
  });

  it('supports object-shaped group claims', () => {
    expect(
      extractProviderGroups({
        groups: [{ name: 'infrastructure' }, { slug: 'executive_team' }],
      }),
    ).toEqual(['infrastructure', 'executive_team']);
  });

  it('falls back to alternate claim keys', () => {
    expect(extractProviderGroups({ group_names: ['infrastructure'] })).toEqual(['infrastructure']);
  });

  it('reads groups from nested provider data payloads', () => {
    expect(extractProviderGroups({ data: { groups: ['infrastructure'] } })).toEqual([
      'infrastructure',
    ]);
  });

  it('reads groups from deeper nested provider payloads', () => {
    expect(
      extractProviderGroups({
        data: {
          data: {
            groups: [{ name: 'infrastructure' }],
          },
        },
      }),
    ).toEqual(['infrastructure']);
  });

  it('reads groups from alternate wrapper fields', () => {
    expect(
      extractProviderGroups({
        data: {
          result: {
            memberOf: ['executive_team'],
          },
        },
      }),
    ).toEqual(['executive_team']);
  });

  it('ignores missing or malformed claims', () => {
    expect(extractProviderGroups({ groups: [null, 123, { unknown: 'value' }] })).toEqual([]);
  });

  it('treats empty provider groups as the existing role', () => {
    expect(resolveSessionRole({}, ['infrastructure'])).toBe('user');
  });

  it('grants admin when a provider group matches the configured admin groups', () => {
    expect(resolveSessionRole({ groups: ['infrastructure'] }, ['infrastructure'])).toBe(
      'admin',
    );
  });

  it('treats accountInfo payloads as provider data when nested under data', () => {
    expect(
      resolveSessionRole(
        {
          data: {
            data: {
              groups: ['executive_team'],
            },
          },
        },
        ['executive_team'],
      ),
    ).toBe('admin');
  });
});