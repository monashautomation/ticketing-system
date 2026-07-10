'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function NewTicketForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, priority: 'normal' }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to create ticket');
      return;
    }

    const { data } = await res.json();
    router.push(`/t/${data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
      <input
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
        placeholder="Describe the issue"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? 'Creating…' : 'New ticket'}
      </button>
    </form>
  );
}
