'use client';

import { useState } from 'react';
import { Check, Link as LinkIcon } from 'lucide-react';
import { buttonSecondary } from '@/lib/styles';

interface ShareTicketButtonProps {
  ticketId: string;
}

const COPIED_RESET_MS = 2000;

export function ShareTicketButton({ ticketId }: ShareTicketButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setIsSharing(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/share`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body.error ?? 'Failed to create share link');
      const url = `${window.location.origin}${body.data.path}`;
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPIED_RESET_MS);
    } catch {
      setError('Could not copy link. Try again.');
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" disabled={isSharing} onClick={() => void share()} className={buttonSecondary}>
        {isCopied ? <Check className="mr-1.5 h-4 w-4" /> : <LinkIcon className="mr-1.5 h-4 w-4" />}
        {isCopied ? 'Link copied' : 'Share ticket'}
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
