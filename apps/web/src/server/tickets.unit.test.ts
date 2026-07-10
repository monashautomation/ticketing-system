import { describe, expect, it } from 'vitest';
import { canViewTicket, isOverdue } from './tickets';

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

describe('isOverdue', () => {
  it('is not overdue when there is no SLA due date', () => {
    expect(isOverdue({ slaDueAt: null, status: 'open' })).toBe(false);
  });

  it('is overdue when the due date has passed and the ticket is still open', () => {
    expect(isOverdue({ slaDueAt: new Date(Date.now() - 1000), status: 'open' })).toBe(true);
  });

  it('is not overdue when the due date is in the future', () => {
    expect(isOverdue({ slaDueAt: new Date(Date.now() + 1000 * 60), status: 'open' })).toBe(false);
  });

  it('is never overdue once resolved, even past the due date', () => {
    expect(isOverdue({ slaDueAt: new Date(Date.now() - 1000), status: 'resolved' })).toBe(false);
  });

  it('is never overdue once closed, even past the due date', () => {
    expect(isOverdue({ slaDueAt: new Date(Date.now() - 1000), status: 'closed' })).toBe(false);
  });
});
