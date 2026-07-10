import { describe, expect, it } from 'vitest';
import { resolveRole } from './roles';

describe('resolveRole', () => {
  it('grants admin when a user group intersects the admin group list', () => {
    expect(resolveRole(['engineering', 'ticketing-admins'], ['ticketing-admins'])).toBe('admin');
  });

  it('defaults to user when no group matches', () => {
    expect(resolveRole(['engineering'], ['ticketing-admins'])).toBe('user');
  });

  it('defaults to user when the user has no groups at all', () => {
    expect(resolveRole([], ['ticketing-admins'])).toBe('user');
  });

  it('defaults to user when admin group list is empty', () => {
    expect(resolveRole(['ticketing-admins'], [])).toBe('user');
  });

  it('is case-sensitive on group names', () => {
    expect(resolveRole(['Ticketing-Admins'], ['ticketing-admins'])).toBe('user');
  });
});
