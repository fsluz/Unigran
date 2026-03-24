import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt    from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { jwtSecret } from '../config/jwt.js';
import { readQuery, writeQuery, val } from '../db/typedb.js';

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
    z.string().min(1).email()
  ),
  password: z.string().min(1),
});

function sign(payload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

/** TypeDB may return booleans as strings depending on driver/encoding. */
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
  const hash = await bcrypt.hash(password, 12);
  const now  = new Date().toISOString();

  try {
    await writeQuery(`
      insert $u isa person,
        has username "${username}",
        has name "${name}",
        has email "${email}",
        ${phone ? `has phone "${phone}",` : ''}
        has password-hash "${hash}",
        has is-active true,
        has is-banned false,
        has can-publish true,
        has page-visibility "public",
        has post-visibility "public";
    `);
    const token = sign({ id: username, username, email, role: 'user', displayName: name });
    res.status(201).json({ token, user: { id: username, username, displayName: name, email, role: 'user' } });
  } catch (err) {
    if (err.message?.includes('unique')) return res.status(409).json({ error: 'Email ou username já em uso' });
    console.error('[register]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;

  try {
    const rows = await readQuery(`
      match $u isa person,
        has email "${email}",
        has username $uname,
        has name $dname,
        has password-hash $phash,
        has is-banned $banned;
      select $uname, $dname, $phash, $banned;
    `);

    if (!rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });
    const row = rows[0];

    const phash = val(row, 'phash');
    if (typeof phash !== 'string' || !phash.length) {
      console.error('[login] person row missing password-hash for email', email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const ok = await bcrypt.compare(password, phash);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });
    if (attrBoolTrue(val(row, 'banned'))) return res.status(403).json({ error: 'Conta banida' });

    const username    = val(row, 'uname');
    const displayName = val(row, 'dname');

    const payload = { id: username, username, displayName, email, role: 'user' };
    res.json({ token: sign(payload), user: payload });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

/* GET /api/auth/me */
router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado' });
  try {
    res.json({ user: jwt.verify(header.slice(7), jwtSecret()) });
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
    const hash = await bcrypt.hash(newPassword, 12);
    const rows = await readQuery(`
      match $u isa person, has email "${email}", has password-hash $ph;
      select $ph;
    `);
    if (rows.length) {
      await writeQuery(`
        match $u isa person, has email "${email}", has password-hash $ph;
        delete $ph of $u;
      `);
    }
    await writeQuery(`
      match $u isa person, has email "${email}";
      insert $u has password-hash "${hash}";
    `);
    res.json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;