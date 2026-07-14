import { describe, expect, it } from 'vitest';
import { parseSearchQuery, segmentSearchQuery } from './search-query';

describe('parseSearchQuery', () => {
  it('returns plain text untouched as freeText with no tokens', () => {
    const result = parseSearchQuery('printer is on fire');
    expect(result.tokens).toEqual([]);
    expect(result.freeText).toBe('printer is on fire');
  });

  it('extracts a single recognized token', () => {
    const result = parseSearchQuery('submitter:jane printer down');
    expect(result.tokens).toEqual([{ type: 'submitter', value: 'jane' }]);
    expect(result.freeText).toBe('printer down');
  });

  it('extracts multiple tokens of different types', () => {
    const result = parseSearchQuery('tag:billing assigned:bob overdue invoice');
    expect(result.tokens).toEqual([
      { type: 'tag', value: 'billing' },
      { type: 'assigned', value: 'bob' },
    ]);
    expect(result.freeText).toBe('overdue invoice');
  });

  it('keeps multiple tokens of the same type as separate entries', () => {
    const result = parseSearchQuery('tag:billing tag:urgent');
    expect(result.tokens).toEqual([
      { type: 'tag', value: 'billing' },
      { type: 'tag', value: 'urgent' },
    ]);
    expect(result.freeText).toBe('');
  });

  it('supports quoted multi-word values', () => {
    const result = parseSearchQuery('submitter:"Jane Doe" printer');
    expect(result.tokens).toEqual([{ type: 'submitter', value: 'Jane Doe' }]);
    expect(result.freeText).toBe('printer');
  });

  it('resolves the author alias to the submitter token type', () => {
    const result = parseSearchQuery('author:jane');
    expect(result.tokens).toEqual([{ type: 'submitter', value: 'jane' }]);
  });

  it('leaves unrecognized key: prefixes (e.g. a URL) as free text', () => {
    const result = parseSearchQuery('see https://example.com for details');
    expect(result.tokens).toEqual([]);
    expect(result.freeText).toBe('see https://example.com for details');
  });

  it('collapses extra whitespace left behind after removing tokens', () => {
    const result = parseSearchQuery('  tag:billing   overdue   invoice  ');
    expect(result.freeText).toBe('overdue invoice');
  });

  it('ignores a trailing key: with no value', () => {
    const result = parseSearchQuery('printer down submitter:');
    expect(result.tokens).toEqual([]);
    expect(result.freeText).toBe('printer down submitter:');
  });
});

describe('segmentSearchQuery', () => {
  function reconstruct(raw: string): string {
    return segmentSearchQuery(raw)
      .map((s) => s.text)
      .join('');
  }

  it('reconstructs the original string exactly for plain text', () => {
    const raw = 'printer is on fire';
    expect(reconstruct(raw)).toBe(raw);
    expect(segmentSearchQuery(raw).every((s) => s.tokenType === null)).toBe(true);
  });

  it('reconstructs the original string exactly with tokens mixed in', () => {
    const raw = 'submitter:jane tag:billing overdue invoice';
    expect(reconstruct(raw)).toBe(raw);
  });

  it('tags a recognized token segment with its type', () => {
    const segments = segmentSearchQuery('submitter:jane printer down');
    expect(segments[0]).toEqual({ text: 'submitter:jane', tokenType: 'submitter' });
    expect(segments[1]).toEqual({ text: ' printer down', tokenType: null });
  });

  it('leaves an unrecognized key: as an untyped segment', () => {
    const segments = segmentSearchQuery('see https://example.com');
    expect(segments.every((s) => s.tokenType === null)).toBe(true);
  });

  it('does not tag a trailing key: with no value', () => {
    const segments = segmentSearchQuery('printer submitter:');
    expect(segments.every((s) => s.tokenType === null)).toBe(true);
  });
});
