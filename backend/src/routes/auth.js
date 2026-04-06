import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt    from 'jsonwebtoken';
import { z } from 'zod';
import { jwtSecret } from '../config/jwt.js';
import { readQuery, writeQuery, typeqlLiteral, encodeHash, decodeHash, val } from '../db/typedb.js';

const router = Router();

const RegisterSchema = z.object({
  name:     z.string().min(2),
  username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/),
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().email()
  ),
  phone:    z.string().optional(),
  password: z.string().min(6),
});

const LoginSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().min(3).max(320)
     .refine((s) => /^[^\s@]+@[^\s@]+(\.[^\s@]+)+$/.test(s), 'Email inválido')
  ),
  password: z.string().min(1),
});

function sign(payload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function attrBoolTrue(v) {
  if (v === true) return true;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return false;
}

/* POST /api/auth/register */
router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, username, email, phone, password } = parsed.data;
  const hash = encodeHash(await bcrypt.hash(password, 12));

  const esc = {
    username: typeqlLiteral(username),
    name:     typeqlLiteral(name),
    email:    typeqlLiteral(email),
    hash,
    phone:    phone ? typeqlLiteral(phone) : '',
  };

  try {
    await writeQuery(`
      insert $u isa person,
        has username "${esc.username}",
        has name "${esc.name}",
        has email "${esc.email}",
        ${esc.phone ? `has phone "${esc.phone}",` : ''}
        has password-hash "${esc.hash}",
        has is-active true,
        has is-banned false,
        has can-publish true,
        has page-visibility "public",
        has post-visibility "public";
    `);
    const payload = { id: username, username, email, role: 'user', displayName: name, phone: phone || null };
    const token = sign(payload);
    res.status(201).json({ token, user: payload });
  } catch (err) {
    if (err.message?.includes('unique')) return res.status(409).json({ error: 'Email ou username já em uso' });
    console.error('[register]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  const body = req.body;
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Corpo da requisição deve ser um objeto JSON com email e password' });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;

  try {
    const safeEmail = typeqlLiteral(email);
    const rows = await readQuery(`
match
  $u isa person,
    has email "${safeEmail}",
    has password-hash $phash;
try { $u has username $uname; };
try { $u has name $dname; };
try { $u has is-banned $banned; };
try { $u has phone $phone; };
try { $u has password-changed-at $pwdat; };
select $uname, $dname, $phash, $banned, $phone, $pwdat;
    `);

    if (!rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const row = rows[0];

    const phashRaw = val(row, 'phash');
    console.log('[login] phashRaw:', phashRaw);
    if (typeof phashRaw !== 'string' || !phashRaw.length) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    console.log('[login] decoded:', decodeHash(phashRaw));
    const ok = await bcrypt.compare(password, decodeHash(phashRaw));
    console.log('[login] ok:', ok);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    if (attrBoolTrue(val(row, 'banned'))) return res.status(403).json({ error: 'Conta banida' });

    let username    = val(row, 'uname');
    let displayName = val(row, 'dname');
    let phone       = val(row, 'phone') || null;
    const rawPwdat  = (row.data ?? row)['pwdat'];
    const passwordChangedAt = rawPwdat?.value ?? val(row, 'pwdat') ?? null;
    if (typeof username !== 'string' || !username.length) username = email.split('@')[0] || 'user';
    if (typeof displayName !== 'string' || !displayName.length) displayName = username;

    const payload = { id: username, username, displayName, email, role: 'user', phone, passwordChangedAt };
    res.json({ token: sign(payload), user: payload });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* GET /api/auth/me */
// Busca dados frescos do banco em vez de confiar só no token
router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado' });
  try {
    const decoded = jwt.verify(header.slice(7), jwtSecret());
    const safeUsername = typeqlLiteral(decoded.username);

    const rows = await readQuery(`
match
  $u isa person, has username "${safeUsername}", has email $email;
try { $u has name $dname; };
try { $u has phone $phone; };
try { $u has password-changed-at $pwdat; };
select $email, $dname, $phone, $pwdat;
    `);

    if (!rows.length) return res.status(401).json({ error: 'Usuário não encontrado' });
    const row = rows[0];

    // val() às vezes não lê atributos opcionais do TypeDB 3 corretamente
    // então lemos direto do objeto quando necessário
    const rawPwdat = (row.data ?? row)['pwdat'];
    const passwordChangedAt = rawPwdat?.value ?? val(row, 'pwdat') ?? null;

    const user = {
      ...decoded,
      displayName:       val(row, 'dname') || decoded.displayName,
      email:             val(row, 'email') || decoded.email,
      phone:             val(row, 'phone') || null,
      passwordChangedAt,
    };

    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

/* PUT /api/auth/reset-password */
router.put('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: 'Email e nova senha obrigatórios' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });

  try {
    const safeEmail = typeqlLiteral(String(email).trim().toLowerCase());

    const rows = await readQuery(`
      match $u isa person, has email "${safeEmail}", has password-hash $ph;
      select $u, $ph;
    `);
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });

    const newHash = encodeHash(await bcrypt.hash(newPassword, 12));

    await writeQuery(`
      match $u isa person, has email "${safeEmail}", has password-hash $ph;
      delete $ph of $u;
    `);
    await writeQuery(`
      match $u isa person, has email "${safeEmail}";
      insert $u has password-hash "${newHash}";
    `);

    res.json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* PUT /api/auth/change-password  (usuário logado, valida senha atual) */
router.put('/change-password', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado' });

  let decoded;
  try { decoded = jwt.verify(header.slice(7), jwtSecret()); }
  catch { return res.status(401).json({ error: 'Token inválido' }); }

  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword)
    return res.status(400).json({ error: 'Preencha todos os campos' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
  if (newPassword !== confirmPassword)
    return res.status(400).json({ error: 'As senhas não coincidem' });

  try {
    const safeUsername = typeqlLiteral(decoded.username);

    const rows = await readQuery(`
      match $u isa person, has username "${safeUsername}", has password-hash $ph;
      select $ph;
    `);
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });

    const phashRaw = val(rows[0], 'ph');
    const ok = await bcrypt.compare(currentPassword, decodeHash(phashRaw));
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

    const newHash = encodeHash(await bcrypt.hash(newPassword, 12));
    const changedAt = new Date().toISOString();

    await writeQuery(`
      match $u isa person, has username "${safeUsername}", has password-hash $ph;
      delete $ph of $u;
    `);
    await writeQuery(`
      match $u isa person, has username "${safeUsername}";
      insert $u has password-hash "${newHash}";
    `);

    // Salva data da última alteração de senha
    try {
      await writeQuery(`
        match $u isa person, has username "${safeUsername}", has password-changed-at $d;
        delete $d of $u;
      `);
    } catch (_) { /* campo ainda não existe no banco — ok */ }
    await writeQuery(`
      match $u isa person, has username "${safeUsername}";
      insert $u has password-changed-at "${changedAt}";
    `);

    res.json({ ok: true, passwordChangedAt: changedAt });
  } catch (err) {
    console.error('[change-password]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* DELETE /api/auth/account  (usuário logado, confirma com senha) */
router.delete('/account', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado' });

  let decoded;
  try { decoded = jwt.verify(header.slice(7), jwtSecret()); }
  catch { return res.status(401).json({ error: 'Token inválido' }); }

  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Informe a senha para confirmar' });

  try {
    const safeUsername = typeqlLiteral(decoded.username);

    // Busca hash da senha para validar
    const rows = await readQuery(`
      match $u isa person, has username "${safeUsername}", has password-hash $ph;
      select $ph;
    `);
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });

    const phashRaw = val(rows[0], 'ph');
    const ok = await bcrypt.compare(password, decodeHash(phashRaw));
    if (!ok) return res.status(401).json({ error: 'Senha incorreta' });

    // Deleta o usuário e todos os seus atributos
    await writeQuery(`
      match $u isa person, has username "${safeUsername}";
      delete $u;
    `);

    res.json({ deleted: true });
  } catch (err) {
    console.error('[delete account]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;