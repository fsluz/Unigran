import { Router } from 'express';
import { z } from 'zod';
import { auth, normalizeRole, requireAtLeast } from '../middleware/auth.js';
import { readQuery, typeqlLiteral, writeQuery } from '../db/typedb.js';

const router = Router();

const RoleSchema = z.object({
  role: z.enum(['admin', 'moderator', 'community_moderator', 'professor', 'user', 'ADMIN']),
});

const BanSchema = z.object({
  banned: z.boolean(),
  reason: z.string().max(240).optional(),
});

const RestrictionSchema = z.object({
  canPublish: z.boolean().optional(),
  visibility: z.enum(['public', 'private', 'friends']).optional(),
  reason: z.string().max(240).optional(),
});

const ReportStatusSchema = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'rejected']),
});

router.use(auth);
router.use(requireAtLeast('moderator'));

router.get('/users', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  try {
    const rows = await readQuery(`
      match
        $u isa person, has username $username;
        try { $u has name $name; };
        try { $u has email $email; };
        try { $u has user-role $role; };
        try { $u has is-banned $banned; };
        try { $u has can-publish $can_publish; };
        try { $u has page-visibility $visibility; };
      fetch {
        "username": $username,
        "name": $name,
        "email": $email,
        "role": $role,
        "banned": $banned,
        "can_publish": $can_publish,
        "visibility": $visibility
      };
    `);
    const users = rows
      .map(row => ({
        username: row.username,
        name: row.name || row.username,
        email: row.email || '',
        role: normalizeRole(row.role),
        banned: row.banned === true || String(row.banned).toLowerCase() === 'true',
        canPublish: row.can_publish !== false && String(row.can_publish).toLowerCase() !== 'false',
        visibility: row.visibility || 'public',
      }))
      .filter(user => !q || `${user.username} ${user.name} ${user.email}`.toLowerCase().includes(q));

    res.json({ users });
  } catch (err) {
    console.error('[admin users]', err);
    res.status(500).json({ error: 'Erro ao listar usuarios' });
  }
});

router.patch('/users/:username/role', requireAtLeast('admin'), async (req, res) => {
  const parsed = RoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const username = typeqlLiteral(req.params.username);
  const role = normalizeRole(parsed.data.role);
  try {
    await writeQuery(`
      match
        $u isa person, has username "${username}";
      update
        $u has user-role "${role}";
    `);
    res.json({ username: req.params.username, role });
  } catch (err) {
    console.error('[admin role]', err);
    res.status(500).json({ error: 'Erro ao salvar cargo' });
  }
});

router.patch('/users/:username/ban', async (req, res) => {
  const parsed = BanSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const username = typeqlLiteral(req.params.username);
  const reason = parsed.data.reason ? `\n        $u has restriction-reason "${typeqlLiteral(parsed.data.reason)}";` : '';
  try {
    await writeQuery(`
      match
        $u isa person, has username "${username}";
      update
        $u has is-banned ${parsed.data.banned};
        ${reason}
    `);
    res.json({ username: req.params.username, banned: parsed.data.banned });
  } catch (err) {
    console.error('[admin ban]', err);
    res.status(500).json({ error: 'Erro ao banir usuario' });
  }
});

router.patch('/users/:username/restrictions', async (req, res) => {
  const parsed = RestrictionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const username = typeqlLiteral(req.params.username);
  const updates = [];
  if (typeof parsed.data.canPublish === 'boolean') updates.push(`$u has can-publish ${parsed.data.canPublish};`);
  if (parsed.data.visibility) updates.push(`$u has page-visibility "${parsed.data.visibility}";`);
  if (parsed.data.reason) updates.push(`$u has restriction-reason "${typeqlLiteral(parsed.data.reason)}";`);
  if (!updates.length) return res.status(400).json({ error: 'Nada para salvar' });

  try {
    await writeQuery(`
      match
        $u isa person, has username "${username}";
      update
        ${updates.join('\n        ')}
    `);
    res.json({ username: req.params.username, saved: true });
  } catch (err) {
    console.error('[admin restrictions]', err);
    res.status(500).json({ error: 'Erro ao salvar restricao' });
  }
});

router.get('/reports', async (_req, res) => {
  try {
    const reports = await readQuery(`
      match
        $r isa report, has report-id $id, has report-reason $reason, has report-status $status, has creation-timestamp $created_at;
        try { report-target(report: $r, reporter: $reporter); $reporter has username $reporter_username; };
        try { report-target(report: $r, reported-user: $reported_user); $reported_user has username $reported_username; };
        try { report-target(report: $r, reported-post: $post); $post has post-id $post_id; };
      fetch {
        "id": $id,
        "reason": $reason,
        "status": $status,
        "created_at": $created_at,
        "reporter": $reporter_username,
        "reported_user": $reported_username,
        "post_id": $post_id
      };
    `);
    res.json({ reports });
  } catch (err) {
    console.error('[admin reports]', err);
    res.json({ reports: [], needsSchema: true });
  }
});

router.patch('/reports/:id', async (req, res) => {
  const parsed = ReportStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    await writeQuery(`
      match
        $r isa report, has report-id "${typeqlLiteral(req.params.id)}";
      update
        $r has report-status "${parsed.data.status}";
    `);
    res.json({ id: req.params.id, status: parsed.data.status });
  } catch (err) {
    console.error('[admin report status]', err);
    res.status(500).json({ error: 'Erro ao salvar denuncia' });
  }
});

export default router;
