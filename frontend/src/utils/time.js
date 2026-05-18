export function relativeTime(value) {
  if (!value) return 'agora';
  const raw = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2}T/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
    ? `${raw}Z`
    : raw;
  const date = new Date(normalized);
  const time = date.getTime();
  if (Number.isNaN(time)) return 'agora';

  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds || 1}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mes`;

  return `${Math.floor(months / 12)}a`;
}
