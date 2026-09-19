export function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso.replace(' ', 'T') + 'Z');
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDayOrTime(iso) {
  if (!iso) return '';
  const date = new Date(iso.replace(' ', 'T') + 'Z');
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return formatTime(iso);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const diffDays = Math.round((now - date) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export function formatLastSeen(iso) {
  if (!iso) return '';
  const date = new Date(iso.replace(' ', 'T') + 'Z');
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = formatTime(iso);
  return sameDay ? `last seen today at ${time}` : `last seen ${formatDayOrTime(iso)} at ${time}`;
}
