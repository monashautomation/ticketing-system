'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { buttonPrimary, errorText, inputSm, mutedText } from '@/lib/styles';

interface Tag {
  id: string;
  name: string;
  color: string;
}

export function TagManager({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6b7280');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    setIsSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'Failed to create tag');
      return;
    }
    setName('');
    router.refresh();
  }

  async function removeTag(id: string) {
    setIsSaving(true);
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    setIsSaving(false);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={createTag} className="mb-6 flex items-center gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tag name"
          required
          className={inputSm}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-10 rounded-md border border-border bg-elevated"
        />
        <button type="submit" disabled={isSaving} className={buttonPrimary}>
          Add tag
        </button>
        {error && <p className={errorText}>{error}</p>}
      </form>

      <ul className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              disabled={isSaving}
              aria-label={`Delete ${tag.name}`}
              className="text-white/80 transition-colors hover:text-white"
            >
              ×
            </button>
          </li>
        ))}
        {tags.length === 0 && <p className={mutedText}>No tags yet.</p>}
      </ul>
    </div>
  );
}
