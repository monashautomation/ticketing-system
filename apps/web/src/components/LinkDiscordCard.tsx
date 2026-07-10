'use client';

import { useState } from 'react';

export function LinkDiscordCard() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  async function generate() {
    const res = await fetch('/api/discord-link/generate', { method: 'POST' });
    const { data } = await res.json();
    setCode(data.code);
    setExpiresAt(data.expiresAt);
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      {code ? (
        <div>
          <p className="text-sm text-neutral-500">
            Run this in Discord within 10 minutes:
          </p>
          <p className="mt-2 rounded-md bg-neutral-100 px-3 py-2 font-mono text-lg">/link {code}</p>
          {expiresAt && (
            <p className="mt-2 text-xs text-neutral-400">Expires {new Date(expiresAt).toLocaleTimeString()}</p>
          )}
        </div>
      ) : (
        <button
          onClick={generate}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Generate code
        </button>
      )}
    </div>
  );
}
