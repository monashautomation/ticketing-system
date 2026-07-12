'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Lock, MessageCircle, RotateCcw, Send, XCircle } from 'lucide-react';
import { buttonPrimary, input } from '@/lib/styles';

function systemMessageStyle(body: string) {
  if (body.startsWith('Ticket reopened')) {
    return { icon: RotateCcw, className: 'border-accent/50 bg-accent-soft text-accent' };
  }
  if (body.startsWith('Ticket closed')) {
    return { icon: XCircle, className: 'border-danger/50 bg-danger-soft text-danger' };
  }
  return { icon: CheckCircle2, className: 'border-success/50 bg-success-soft text-success' };
}

interface Author {
  name: string;
}

interface Message {
  id: string;
  body: string;
  isInternalNote: boolean;
  isSystemMessage: boolean;
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
        {messages.length === 0 && (
          <li className="flex flex-col items-center gap-2 py-6 text-center">
            <MessageCircle className="h-6 w-6 text-text-tertiary" />
            <p className="text-sm text-text-secondary">No replies yet.</p>
          </li>
        )}
        {messages.map((message, index) => {
          if (message.isSystemMessage) {
            const { icon: Icon, className } = systemMessageStyle(message.body);
            return (
              <li
                key={message.id}
                className={`animate-fade-in-up flex items-center gap-2 rounded-lg border p-3 text-sm font-medium ${className}`}
                style={{ animationDelay: `${Math.min(index, 6) * 25}ms` }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {message.body}
              </li>
            );
          }
          return (
            <li
              key={message.id}
              className={`animate-fade-in-up rounded-lg border p-3 text-sm transition-colors ${
                message.isInternalNote ? 'border-warning/40 bg-warning-soft' : 'border-border bg-panel'
              }`}
              style={{ animationDelay: `${Math.min(index, 6) * 25}ms` }}
            >
              <p className="mb-1 flex items-center gap-1 text-xs font-medium text-text-secondary">
                {message.author.name}
                {message.isInternalNote && (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    internal note
                  </span>
                )}
              </p>
              <p className="text-text">{message.body}</p>
            </li>
          );
        })}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          className={input}
          rows={3}
          placeholder="Write a reply…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <div className="flex items-center justify-between">
          {canAddInternalNote ? (
            <label className="flex items-center gap-2 text-sm text-text-secondary">
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
            className={`${buttonPrimary} gap-1.5 transition-all hover:-translate-y-0.5 active:translate-y-0`}
          >
            <Send className="h-3.5 w-3.5" />
            Reply
          </button>
        </div>
      </form>
    </div>
  );
}
