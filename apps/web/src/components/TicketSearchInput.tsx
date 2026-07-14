'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  segmentSearchQuery,
  type SearchTokenType,
} from '@ticketing/shared';

interface TagOption {
  id: string;
  name: string;
  color: string;
}

interface UserOption {
  id: string;
  name: string;
}

interface TicketSearchInputProps {
  defaultValue: string;
  tags: TagOption[];
  admins: UserOption[];
}

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 1;
const MAX_SUGGESTIONS = 6;

// Reuses the app's four semantic colors across seven token types -- distinguishing typed
// tokens from free text matters more here than a unique hue per type.
const TOKEN_COLOR_CLASS: Record<SearchTokenType, string> = {
  submitter: 'text-accent',
  cced: 'text-success',
  assigned: 'text-warning',
  tag: 'text-danger',
  status: 'text-accent',
  priority: 'text-warning',
  type: 'text-success',
};

/** Recognized `key:` prefixes that resolve to a SearchTokenType, mirroring search-query.ts. */
const KEY_ALIASES: Record<string, SearchTokenType> = {
  submitter: 'submitter',
  author: 'submitter',
  cced: 'cced',
  cc: 'cced',
  assigned: 'assigned',
  assignee: 'assigned',
  tag: 'tag',
  status: 'status',
  priority: 'priority',
  type: 'type',
};

interface PendingToken {
  /** Index in the raw string where the `key:` prefix starts. */
  start: number;
  type: SearchTokenType;
  key: string;
  partialValue: string;
}

/** Detects an unfinished `key:partial` token ending exactly at the cursor, if any. */
function findPendingToken(value: string, cursor: number): PendingToken | null {
  const upToCursor = value.slice(0, cursor);
  const match = /([a-zA-Z]+):(\S*)$/.exec(upToCursor);
  if (!match) return null;

  const full = match[0];
  const key = match[1] ?? '';
  const partialValue = match[2] ?? '';
  const type = KEY_ALIASES[key.toLowerCase()];
  if (!type) return null;

  return {
    start: cursor - full.length,
    type,
    key,
    partialValue,
  };
}

function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

export function TicketSearchInput({ defaultValue, tags, admins }: TicketSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [pending, setPending] = useState<PendingToken | null>(null);
  const [remoteSuggestions, setRemoteSuggestions] = useState<UserOption[]>([]);

  const segments = useMemo(() => segmentSearchQuery(value), [value]);

  useEffect(() => {
    if (!pending || pending.type === 'tag' || pending.partialValue.length < MIN_QUERY_LENGTH) {
      setRemoteSuggestions([]);
      return;
    }
    if (pending.type !== 'submitter' && pending.type !== 'cced' && pending.type !== 'assigned') {
      setRemoteSuggestions([]);
      return;
    }

    const endpoint = pending.type === 'assigned' ? '/api/users/admins' : '/api/users/cc-candidates';
    const handle = setTimeout(() => {
      fetch(`${endpoint}?q=${encodeURIComponent(pending.partialValue)}`)
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((body) => setRemoteSuggestions(body.data ?? []))
        .catch(() => setRemoteSuggestions([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [pending]);

  const localSuggestions = useMemo(() => {
    if (!pending) return [];
    const needle = pending.partialValue.toLowerCase();

    if (pending.type === 'tag') {
      return tags
        .filter((t) => t.name.toLowerCase().includes(needle))
        .slice(0, MAX_SUGGESTIONS)
        .map((t) => ({ id: t.id, label: t.name }));
    }
    if (pending.type === 'status') {
      return TICKET_STATUSES.filter((s) => s.includes(needle))
        .slice(0, MAX_SUGGESTIONS)
        .map((s) => ({ id: s, label: s }));
    }
    if (pending.type === 'priority') {
      return TICKET_PRIORITIES.filter((p) => p.includes(needle))
        .slice(0, MAX_SUGGESTIONS)
        .map((p) => ({ id: p, label: p }));
    }
    if (pending.type === 'type') {
      return TICKET_TYPES.filter((t) => t.includes(needle))
        .slice(0, MAX_SUGGESTIONS)
        .map((t) => ({ id: t, label: t }));
    }
    return remoteSuggestions.slice(0, MAX_SUGGESTIONS).map((u) => ({ id: u.id, label: u.name }));
  }, [pending, tags, remoteSuggestions]);

  function updatePendingFromCursor(nextValue: string, cursor: number): void {
    setPending(findPendingToken(nextValue, cursor));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setValue(e.target.value);
    updatePendingFromCursor(e.target.value, e.target.selectionStart ?? e.target.value.length);
  }

  function handleSelectionChange(): void {
    const el = inputRef.current;
    if (!el) return;
    updatePendingFromCursor(el.value, el.selectionStart ?? el.value.length);
  }

  function applySuggestion(label: string): void {
    if (!pending) return;
    const before = value.slice(0, pending.start);
    const after = value.slice(pending.start).replace(/^[a-zA-Z]+:\S*/, '');
    const replacement = `${pending.key}:${quoteIfNeeded(label)} `;
    const next = `${before}${replacement}${after}`;
    setValue(next);
    setPending(null);
    setRemoteSuggestions([]);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const cursor = before.length + replacement.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="relative h-8 w-56 sm:w-72">
      <div className="absolute inset-0 rounded-md border border-border bg-elevated" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-2 py-1.5 text-sm leading-5"
      >
        {value.length === 0 ? (
          <span className="text-text-tertiary">Search tickets… (try submitter:, tag:)</span>
        ) : (
          segments.map((segment, i) => (
            <span
              key={i}
              className={segment.tokenType ? `font-medium ${TOKEN_COLOR_CLASS[segment.tokenType]}` : 'text-text'}
            >
              {segment.text}
            </span>
          ))
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        name="q"
        value={value}
        onChange={handleChange}
        onClick={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        onBlur={() => setTimeout(() => setPending(null), 150)}
        className="absolute inset-0 h-full w-full bg-transparent px-2 py-1.5 text-sm leading-5 text-transparent caret-text outline-none focus:border-accent"
        autoComplete="off"
      />
      {pending && localSuggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full animate-fade-in-up rounded-md border border-border bg-panel shadow-lg">
          {localSuggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(s.label)}
                className="block w-full px-3 py-2 text-left text-sm text-text transition-colors hover:bg-elevated"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
