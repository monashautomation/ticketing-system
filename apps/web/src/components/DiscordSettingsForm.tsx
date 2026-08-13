'use client';

import { useState } from 'react';
import { buttonPrimary, card, errorText, input, label, mutedText } from '@/lib/styles';

interface DiscordSettingsFormProps {
  newTicketChannelId: string;
  unassignedAlertChannelId: string;
}

export function DiscordSettingsForm({
  newTicketChannelId: initialNewTicketChannelId,
  unassignedAlertChannelId: initialUnassignedAlertChannelId,
}: DiscordSettingsFormProps) {
  const [newTicketChannelId, setNewTicketChannelId] = useState(initialNewTicketChannelId);
  const [unassignedAlertChannelId, setUnassignedAlertChannelId] = useState(initialUnassignedAlertChannelId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch('/api/discord-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newTicketChannelId, unassignedAlertChannelId }),
    });

    setIsSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'Failed to save settings');
      return;
    }
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className={`${card} flex flex-col gap-5`}>
      <label className={label}>
        New-ticket announcement channel ID
        <input
          type="text"
          inputMode="numeric"
          value={newTicketChannelId}
          onChange={(e) => setNewTicketChannelId(e.target.value)}
          placeholder="Discord channel ID (leave blank to disable)"
          className={input}
        />
        <span className={mutedText}>Posts &quot;New ticket: {'{title}'}&quot; whenever a ticket is created.</span>
      </label>

      <label className={label}>
        Unassigned-backlog alert channel ID
        <input
          type="text"
          inputMode="numeric"
          value={unassignedAlertChannelId}
          onChange={(e) => setUnassignedAlertChannelId(e.target.value)}
          placeholder="Discord channel ID (leave blank to disable)"
          className={input}
        />
        <span className={mutedText}>
          Once daily at 9am, posts a count of unassigned open tickets with a link to the admin queue (never links
          to a specific ticket).
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isSaving} className={buttonPrimary}>
          {isSaving ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className={mutedText}>Saved.</span>}
        {error && <p className={errorText}>{error}</p>}
      </div>
    </form>
  );
}
