export const SEARCH_TOKEN_TYPES = [
  'submitter',
  'cced',
  'assigned',
  'tag',
  'status',
  'priority',
  'type',
] as const;
export type SearchTokenType = (typeof SEARCH_TOKEN_TYPES)[number];

export interface SearchToken {
  type: SearchTokenType;
  value: string;
}

export interface ParsedSearchQuery {
  tokens: SearchToken[];
  freeText: string;
}

/** Maps recognized `key:` prefixes (including aliases) to a canonical SearchTokenType. */
const TOKEN_ALIASES: Record<string, SearchTokenType> = {
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

/** Matches `key:value` or `key:"quoted value"`. Unrecognized keys (e.g. a bare URL like
 * `https://example.com`) are left untouched and fall through to free text. */
const TOKEN_PATTERN = /([a-zA-Z]+):(?:"([^"]*)"|(\S+))/g;

/**
 * Splits a raw admin search string into recognized `key:value` filter tokens and the
 * remaining free text (for full-text search). Multiple tokens of the same type are all kept
 * (e.g. `tag:billing tag:urgent` -> two `tag` tokens) so the caller can decide OR/AND semantics.
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const tokens: SearchToken[] = [];

  const freeText = raw
    .replace(TOKEN_PATTERN, (match, key: string, quoted: string | undefined, plain: string | undefined) => {
      const type = TOKEN_ALIASES[key.toLowerCase()];
      if (!type) return match;

      const value = quoted !== undefined ? quoted : (plain ?? '');
      if (value.length === 0) return match;

      tokens.push({ type, value });
      return '';
    })
    .replace(/\s+/g, ' ')
    .trim();

  return { tokens, freeText };
}

export interface SearchQuerySegment {
  /** The exact original substring -- concatenating every segment's `text` reproduces `raw`. */
  text: string;
  /** Non-null when this segment is a recognized, complete `key:value` token. */
  tokenType: SearchTokenType | null;
}

/**
 * Like `parseSearchQuery`, but preserves every character's original position instead of
 * stripping tokens out -- used to render the live token-highlighting overlay in
 * TicketSearchInput, where the overlay text must line up exactly with the underlying input.
 */
export function segmentSearchQuery(raw: string): SearchQuerySegment[] {
  const segments: SearchQuerySegment[] = [];
  let lastIndex = 0;

  for (const match of raw.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    const [full, key, quoted, plain] = match;
    if (index > lastIndex) {
      segments.push({ text: raw.slice(lastIndex, index), tokenType: null });
    }

    const type = TOKEN_ALIASES[(key ?? '').toLowerCase()];
    const value = quoted !== undefined ? quoted : (plain ?? '');
    segments.push({ text: full, tokenType: type && value.length > 0 ? type : null });

    lastIndex = index + full.length;
  }

  if (lastIndex < raw.length) {
    segments.push({ text: raw.slice(lastIndex), tokenType: null });
  }

  return segments;
}
