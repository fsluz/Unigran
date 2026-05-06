export function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (s == null || !String(s).trim()) {
    throw new Error('JWT_SECRET is not configured');
  }
  return String(s).trim();
}
