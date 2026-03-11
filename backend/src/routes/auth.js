import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt    from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { readTx, writeTx, collect } from '../db/typedb.js';

const router = Router();

const RegisterSchema = z.object({
  name:     z.string().min(2),
  username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/),
  email:    z.string().email(),
  phone:    z.string().optional(),
  password: z.string().min(6),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

function sign(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/* POST /api/auth/register */
router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, username, email, phone, password } = parsed.data;
  const hash = await bcrypt.hash(password, 12);
  const id   = uuid();
  const now  = new Date().toISOString();

  try {
    await writeTx(async tx => {
      await tx.query.insert(`
        insert $u isa user,
          has id "${id}",
          has username "${username}",
          has display-name "${name}",
          has email "${email}",
          has password-hash "${hash}",
          ${phone ? `has phone "${phone}",` : ''}
          has role "user",
          has is-active true,
          has is-banned false,
          has created-at ${now};
      `);
    });

    const token = sign({ id, username, email, role: 'user', displayName: name });
    res.status(201).json({ token, user: { id, username, displayName: name, email, role: 'user' } });
  } catch (err) {
    if (err.message?.includes('unique')) {
      return res.status(409).json({ error: 'Email ou username já em uso' });
    }
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
    const row = await readTx(async tx => {
      const rows = await collect(tx.query.get(`
        match $u isa user,
          has email "${email}",
          has id $id,
          has username $un,
          has display-name $dn,
          has password-hash $ph,
          has role $r,
          has is-banned $ib;
        get $id, $un, $dn, $ph, $r, $ib;
      `));
      return rows[0] ?? null;
    });

    if (!row) return res.status(401).json({ error: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(password, row.get('ph').value);
    if (!ok)  return res.status(401).json({ error: 'Credenciais inválidas' });
    if (row.get('ib').value) return res.status(403).json({ error: 'Conta banida' });

    const payload = {
      id:          row.get('id').value,
      username:    row.get('un').value,
      displayName: row.get('dn').value,
      email,
      role:        row.get('r').value,
    };
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
    res.json({ user: jwt.verify(header.slice(7), process.env.JWT_SECRET) });
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;
