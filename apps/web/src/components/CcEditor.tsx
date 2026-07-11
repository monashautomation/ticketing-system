'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { input, mutedText } from '@/lib/styles';

interface CcOption {
  id: string;
  name: string;
}

interface CcEditorProps {
  ticketId: string;
  initialWatchers: CcOption[];
  label?: string;
}

const CC_SEARCH_DEBOUNCE_MS = 250;
const CC_MIN_QUERY_LENGTH = 2;

export function CcEditor({ ticketId, initialWatchers, label = 'CC:' }: CcEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedWatchers, setSelectedWatchers] = useState<CcOption[]>(initialWatchers);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CcOption[]>([]);

  useEffect(() => {
    if (query.trim().length < CC_MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/users/cc-candidates?q=${encodeURIComponent(query.trim())}`)
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((body) => setResults(body.data ?? []))
        .catch(() => setResults([]));
    }, CC_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  async function save(next: CcOption[]) {
    setIsSaving(true);
    await fetch(`/api/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watcherIds: next.map((w) => w.id) }),
    });
    setIsSaving(false);
    router.refresh();
  }

  function addWatcher(candidate: CcOption) {
    if (selectedWatchers.some((w) => w.id === candidate.id)) return;
    const next = [...selectedWatchers, candidate];
    setSelectedWatchers(next);
    setQuery('');
    setResults([]);
    void save(next);
  }

  function removeWatcher(userId: string) {
    const next = selectedWatchers.filter((w) => w.id !== userId);
    setSelectedWatchers(next);
    void save(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={mutedText}>{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {selectedWatchers.map((w) => (
          <span
            key={w.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong"
          >
            {w.name}
            <button
              type="button"
              disabled={isSaving}
              onClick={() => removeWatcher(w.id)}
              className="text-text-tertiary transition-colors hover:text-text"
              aria-label={`Remove ${w.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!isSearchOpen && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => setIsSearchOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text"
          >
            <UserPlus className="h-3 w-3" />
            Add CC
          </button>
        )}
      </div>
      {isSearchOpen && (
        <div className="relative max-w-xs">
          <input
            className={input}
            placeholder="Search people by name…"
            value={query}
            disabled={isSaving}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setTimeout(() => setIsSearchOpen(false), 150)}
          />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full animate-fade-in-up rounded-md border border-border bg-panel shadow-lg">
              {results.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addWatcher(candidate)}
                    className="block w-full px-3 py-2 text-left text-sm text-text transition-colors hover:bg-elevated"
                  >
                    {candidate.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
