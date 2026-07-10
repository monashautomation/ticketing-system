'use client';

import { useEffect, useRef, useState } from 'react';

interface Author {
  name: string;
}

interface Message {
  id: string;
  body: string;
  isInternalNote: boolean;
  createdAt: string | Date;
  author: Author;
}

interface TicketThreadProps {
  ticketId: string;
  token?: string;
  initialMessages: Message[];
  canAddInternalNote: boolean;
}

export function TicketThread({ ticketId, token, initialMessages, canAddInternalNote }: TicketThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const query = token ? `?token=${token}` : '';
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/tickets/${ticketId}/stream${query}`);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type !== 'message') return;
      // Debounce: multiple rapid replies only trigger one refetch.
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      refetchTimer.current = setTimeout(async () => {
        const res = await fetch(`/api/tickets/${ticketId}${query}`);
        if (!res.ok) return;
        const { data } = await res.json();
        setMessages(data.messages);
      }, 300);
    };
    return () => source.close();
  }, [ticketId, query]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    const res = await fetch(`/api/tickets/${ticketId}/messages${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, isInternalNote }),
    });
    setIsSubmitting(false);
    if (res.ok) {
      const { data } = await res.json();
      setMessages((prev) => [...prev, data]);
      setBody('');
      setIsInternalNote(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {messages.map((message) => (
          <li
            key={message.id}
            className={`rounded-lg border p-3 text-sm ${
              message.isInternalNote ? 'border-amber-300 bg-amber-50' : 'border-neutral-200'
            }`}
          >
            <p className="mb-1 text-xs font-medium text-neutral-500">
              {message.author.name}
              {message.isInternalNote ? ' · internal note' : ''}
            </p>
            <p>{message.body}</p>
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
          rows={3}
          placeholder="Write a reply…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <div className="flex items-center justify-between">
          {canAddInternalNote ? (
            <label className="flex items-center gap-2 text-sm text-neutral-500">
              <input
                type="checkbox"
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
              />
              Internal note (admins only)
            </label>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Reply
          </button>
        </div>
      </form>
    </div>
  );
}
