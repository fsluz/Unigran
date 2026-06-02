const WEAK_SECRETS = new Set([
  'troque_este_segredo', 'change_this_secret', 'secret', 'password',
  'jwt_secret', 'mysecret', '123456', 'segredo',
]);

export function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (s == null || !String(s).trim()) {
    throw new Error('JWT_SECRET nao configurado. Defina JWT_SECRET no arquivo .env com pelo menos 32 caracteres.');
  }
  const clean = String(s).trim();
  if (clean.length < 32) {
    throw new Error(`JWT_SECRET muito curto (${clean.length} chars). Use pelo menos 32 caracteres aleatorios.`);
  }
  if (WEAK_SECRETS.has(clean.toLowerCase())) {
    throw new Error('JWT_SECRET inseguro detectado. Gere um segredo forte: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  }
  return clean;
}
