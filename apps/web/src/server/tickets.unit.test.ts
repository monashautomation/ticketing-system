import { describe, expect, it } from 'vitest';
import { canViewTicket } from './tickets';

const ticket = { createdById: 'user-1', assignedToId: 'user-2' };

describe('canViewTicket', () => {
  it('denies access when there is no user', () => {
    expect(canViewTicket(ticket, null)).toBe(false);
  });

  it('allows the creator', () => {
    expect(canViewTicket(ticket, { id: 'user-1', role: 'user' })).toBe(true);
  });

  it('allows the assignee', () => {
    expect(canViewTicket(ticket, { id: 'user-2', role: 'user' })).toBe(true);
  });

  it('denies an unrelated user', () => {
    expect(canViewTicket(ticket, { id: 'user-3', role: 'user' })).toBe(false);
  });

  it('always allows admins, even when unrelated to the ticket', () => {
    expect(canViewTicket(ticket, { id: 'user-3', role: 'admin' })).toBe(true);
  });

  it('denies an unrelated user even when the ticket has no assignee', () => {
    expect(canViewTicket({ createdById: 'user-1', assignedToId: null }, { id: 'user-4', role: 'user' })).toBe(
      false,
    );
  });
});
