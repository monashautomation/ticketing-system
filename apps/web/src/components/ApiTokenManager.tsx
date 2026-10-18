'use client';

import { useState } from 'react';
import {
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  card,
  errorText,
  inputSm,
  label,
  mutedText,
  table,
  tableCell,
  tableHead,
  tableHeadCell,
  tableRowDivider,
  tableWrap,
} from '@/lib/styles';

interface ApiToken {
  id: string;
  name: string;
  preview: string;
  readOnly: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  owner?: { id: string; name: string; email: string };
}

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function ApiTokenManager({ isAdmin }: { isAdmin: boolean }) {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  async function load() {
    setError(null);
    const res = await fetch(isAdmin ? '/api/api-tokens/all' : '/api/api-tokens');
    if (!res.ok) {
      setError('Failed to load tokens');
      return;
    }
    const body = await res.json();
    setTokens(body.data ?? []);
    setLoaded(true);
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setCreatedSecret(null);
    const res = await fetch('/api/api-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        readOnly,
        ...(expiresInDays ? { expiresInDays: Number(expiresInDays) } : {}),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(typeof body?.error === 'string' ? body.error : 'Failed to create token');
      return;
    }
    const body = await res.json();
    setCreatedSecret(body.data.token);
    setName('');
    await load();
  }

  async function revoke(id: string) {
    setBusy(true);
    await fetch(`/api/api-tokens/${id}`, { method: 'DELETE' });
    setBusy(false);
    await load();
  }

  return (
    <div>
      <form onSubmit={createToken} className={`${card} mb-6 flex flex-wrap items-end gap-3`}>
        <label className={label}>
          Token name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. maticket CLI"
            required
            maxLength={60}
            className={inputSm}
          />
        </label>
        <label className={label}>
          Expires in (days)
          <input
            type="number"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            min={1}
            max={365}
            placeholder="never"
            className={inputSm}
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-text-secondary">
          <input type="checkbox" checked={!readOnly} onChange={(e) => setReadOnly(!e.target.checked)} />
          Read &amp; write (uncheck = read-only)
        </label>
        <button type="submit" disabled={busy} className={buttonPrimary}>
          Create token
        </button>
      </form>

      {error && <p className={`${errorText} mb-4`}>{error}</p>}

      {createdSecret && (
        <div className="mb-6 rounded-lg border border-accent bg-panel p-4">
          <p className="mb-2 text-sm font-medium text-text">
            Your new token — copy it now, it will not be shown again:
          </p>
          <code className="block break-all rounded-md bg-elevated p-3 text-sm text-accent">
            {createdSecret}
          </code>
        </div>
      )}

      {!loaded ? (
        <button onClick={load} className={buttonSecondary}>
          Load tokens
        </button>
      ) : (
        <div className={tableWrap}>
          <table className={table}>
            <thead className={tableHead}>
              <tr>
                <th className={tableHeadCell}>Name</th>
                {isAdmin && <th className={tableHeadCell}>Owner</th>}
                <th className={tableHeadCell}>Token</th>
                <th className={tableHeadCell}>Access</th>
                <th className={tableHeadCell}>Created</th>
                <th className={tableHeadCell}>Last used</th>
                <th className={tableHeadCell}>Expires</th>
                <th className={tableHeadCell} />
              </tr>
            </thead>
            <tbody className={tableRowDivider}>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td className={tableCell}>{t.name}</td>
                  {isAdmin && <td className={tableCell}>{t.owner?.name ?? '—'}</td>}
                  <td className={`${tableCell} font-mono text-xs`}>{t.preview}</td>
                  <td className={tableCell}>{t.readOnly ? 'read-only' : 'read & write'}</td>
                  <td className={tableCell}>{fmt(t.createdAt)}</td>
                  <td className={tableCell}>{fmt(t.lastUsedAt)}</td>
                  <td className={tableCell}>{fmt(t.expiresAt)}</td>
                  <td className={`${tableCell} text-right`}>
                    {t.revokedAt ? (
                      <span className="text-xs text-text-tertiary">revoked</span>
                    ) : (
                      <button
                        onClick={() => revoke(t.id)}
                        disabled={busy}
                        className={buttonDanger}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {tokens.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className={tableCell}>
                    <p className={mutedText}>No API tokens yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
