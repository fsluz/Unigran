export function relativeTime(value) {
  if (!value) return 'agora';
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return 'agora';

  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds || 1}s atras`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atras`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atras`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atras`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m atras`;

  return `${Math.floor(months / 12)}a atras`;
}
