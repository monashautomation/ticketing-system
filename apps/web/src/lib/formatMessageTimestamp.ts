function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(date: Date): string {
  return date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(' ', '')
    .toLowerCase();
}

function formatDate(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Dynamic relative timestamp for the reply thread: bare time today, "Yesterday" for
 * the day before, MM/DD for the current year, and MM/DD/YYYY once the year rolls over.
 */
export function formatMessageTimestamp(input: string | Date, now: Date = new Date()): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const time = formatTime(date);

  if (isSameDay(date, now)) return time;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Yesterday ${time}`;

  if (date.getFullYear() === now.getFullYear()) return `${formatDate(date)} ${time}`;

  return `${formatDate(date)}/${date.getFullYear()} ${time}`;
}
