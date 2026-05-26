import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auth, normalizeRole } from '../middleware/auth.js';
import { hasPermission, requirePermission } from '../modules/auth/rbac.js';
import { encodeHash, readQuery, typeqlLiteral, writeQuery } from '../db/typedb.js';
import { auditLog, readAuditLogs } from '../services/audit.service.js';
import { getAvaPowerBiSnapshot } from '../modules/academic/typedbAvaStore.js';

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

const router = Router();

const RoleSchema = z.object({
  role: z.enum([
    'super_admin',
    'social_admin',
    'admin',
    'coordination',
    'secretary',
    'moderator',
    'professor',
    'student',
    'user',
  ]),
});

const PlatformUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(6).max(120),
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

router.get('/users', requirePermission('users:platform_manage'), async (req, res) => {
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
    let users = rows
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

router.post('/users', requirePermission('users:create'), async (req, res) => {
  const parsed = PlatformUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, username, email, password } = parsed.data;
  const hash = encodeHash(await bcrypt.hash(password, 12));
  try {
    await writeQuery(`
      insert
        $u isa person,
          has username "${typeqlLiteral(username)}",
          has name "${typeqlLiteral(name)}",
          has email "${typeqlLiteral(email)}",
          has password-hash "${hash}",
          has is-active true,
          has is-banned false,
          has can-publish true,
          has user-role "user",
          has page-visibility "public",
          has post-visibility "public";
    `);
    auditLog({ action: 'PLATFORM_USER_CREATED', category: 'ADMIN', actor: req.user?.username, target: username, ip: getIp(req), meta: { email, role: 'user' } });
    res.status(201).json({ username, name, email, role: 'user', banned: false, canPublish: true, visibility: 'public' });
  } catch (err) {
    if (err.message?.includes('unique') || err.message?.includes('key')) {
      return res.status(409).json({ error: 'Email ou username ja em uso' });
    }
    console.error('[admin create user]', err);
    res.status(500).json({ error: 'Erro ao criar login' });
  }
});

router.patch('/users/:username/role', requirePermission('users:platform_manage'), async (req, res) => {
  const parsed = RoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const username = typeqlLiteral(req.params.username);
  const role = normalizeRole(parsed.data.role);
  try {
    const actorRole = normalizeRole(req.user?.role);
    const maySetRole = hasPermission(req.user, 'permissions:manage')
      || (actorRole === 'social_admin' && ['user', 'moderator'].includes(role));
    if (!maySetRole) {
      return res.status(403).json({ error: 'Cargo fora do seu escopo de administracao social' });
    }
    await writeQuery(`
      match
        $u isa person, has username "${username}";
      update
        $u has user-role "${role}";
    `);
    auditLog({ action: 'USER_ROLE_CHANGED', category: 'ADMIN', actor: req.user?.username, target: req.params.username, ip: getIp(req), meta: { newRole: role } });
    res.json({ username: req.params.username, role });
  } catch (err) {
    console.error('[admin role]', err);
    res.status(500).json({ error: 'Erro ao salvar cargo' });
  }
});

router.patch('/users/:username/ban', requirePermission('posts:moderate'), async (req, res) => {
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
    auditLog({
      action: parsed.data.banned ? 'USER_BANNED' : 'USER_UNBANNED',
      category: 'ADMIN',
      actor: req.user?.username,
      target: req.params.username,
      ip: getIp(req),
      meta: { reason: parsed.data.reason || null },
      level: 'ALERT',
    });
    res.json({ username: req.params.username, banned: parsed.data.banned });
  } catch (err) {
    console.error('[admin ban]', err);
    res.status(500).json({ error: 'Erro ao banir usuario' });
  }
});

router.patch('/users/:username/restrictions', requirePermission('posts:moderate'), async (req, res) => {
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
    auditLog({
      action: 'USER_RESTRICTIONS_UPDATED',
      category: 'ADMIN',
      actor: req.user?.username,
      target: req.params.username,
      ip: getIp(req),
      meta: parsed.data,
    });
    res.json({ username: req.params.username, saved: true });
  } catch (err) {
    console.error('[admin restrictions]', err);
    res.status(500).json({ error: 'Erro ao salvar restricao' });
  }
});

router.get('/reports', requirePermission('reports:read'), async (_req, res) => {
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

router.patch('/reports/:id', requirePermission('reports:update'), async (req, res) => {
  const parsed = ReportStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    await writeQuery(`
      match
        $r isa report, has report-id "${typeqlLiteral(req.params.id)}";
      update
        $r has report-status "${parsed.data.status}";
    `);
    auditLog({
      action: 'REPORT_STATUS_CHANGED',
      category: 'ADMIN',
      actor: req.user?.username,
      target: req.params.id,
      ip: getIp(req),
      meta: { status: parsed.data.status },
    });
    res.json({ id: req.params.id, status: parsed.data.status });
  } catch (err) {
    console.error('[admin report status]', err);
    res.status(500).json({ error: 'Erro ao salvar denuncia' });
  }
});

// GET /api/admin/audit-logs — apenas admins
router.get('/audit-logs', requirePermission('audit:read'), async (req, res) => {
  try {
    const { category, action, actor, level, from, to, limit } = req.query;

    // Filtros passados direto pro service (query no banco, não em memória)
    const logs = await readAuditLogs({ category, action, actor, level, from, to, limit });

    auditLog({ action: 'AUDIT_LOGS_ACCESSED', category: 'ADMIN', actor: req.user?.username, ip: getIp(req) });
    res.json({ logs, total: logs.length });
  } catch (err) {
    console.error('[audit-logs]', err);
    res.status(500).json({ error: 'Erro ao ler logs' });
  }
});

router.get('/power-bi', requirePermission('system:manage'), async (req, res) => {
  try {
    const [ava, typedbUsers, typedbPosts, typedbComments] = await Promise.all([
      getAvaPowerBiSnapshot(),
      readQuery(`
        match
          $u isa person, has username $username;
          try { $u has name $name; };
          try { $u has user-role $role; };
          try { $u has can-publish $can_publish; };
        fetch {
          "username": $username,
          "name": $name,
          "role": $role,
          "can_publish": $can_publish
        };
      `).catch(() => []),
      readQuery(`
        match
          $p isa post, has post-id $id;
          try { $p has creation-timestamp $created_at; };
          try { $p has post-content $content; };
          try { $p has portfolio-id $portfolio_id; };
        fetch {
          "id": $id,
          "created_at": $created_at,
          "content": $content,
          "portfolio_id": $portfolio_id
        };
      `).catch(() => []),
      readQuery(`
        match
          $c isa comment, has comment-id $id;
          try { $c has creation-timestamp $created_at; };
        fetch {
          "id": $id,
          "created_at": $created_at
        };
      `).catch(() => []),
    ]);

    const socialPosts = typedbPosts.length;
    const portfolioPosts = typedbPosts.filter(post => post.portfolio_id).length;
    const activeAuthors = new Set([
      ...ava.submissions.map(item => item.username),
      ...ava.portfolio.map(item => item.username),
    ]).size;
    const interactions = typedbComments.length + ava.kpis.submissions + ava.kpis.completedMaterials;
    const engagementPerPost = socialPosts ? Number((interactions / socialPosts).toFixed(1)) : interactions;
    const conversion = ava.kpis.submissions ? Math.round((ava.kpis.portfolioItems / ava.kpis.submissions) * 100) : 0;

    auditLog({ action: 'POWER_BI_ACCESSED', category: 'ADMIN', actor: req.user?.username, ip: getIp(req) });
    res.json({
      generatedAt: new Date().toISOString(),
      repoReference: 'https://github.com/v-cerqueira/Power-Bi',
      source: {
        primary: 'TypeDB',
        secondary: 'TypeDB academic relations',
        note: 'Endpoint de BI interno consome as entidades sociais e academicas persistidas no TypeDB.',
      },
      kpis: {
        users: typedbUsers.length || ava.dimensions.students,
        activeAuthors,
        socialPosts,
        comments: typedbComments.length,
        interactions,
        engagementPerPost,
        portfolioItems: ava.kpis.portfolioItems,
        resumes: ava.kpis.resumes,
        submissions: ava.kpis.submissions,
        averageProgress: ava.kpis.averageProgress,
        portfolioConversion: conversion,
        portfolioPosts,
      },
      courses: ava.byCourse,
      recentPortfolio: ava.portfolio,
      recentSubmissions: ava.submissions,
      people: typedbUsers.slice(0, 20),
      rai: {
        signal: engagementPerPost > 18 ? 'Rede aquecida' : engagementPerPost > 8 ? 'Ritmo saudavel' : 'Precisa ativacao',
        risk: activeAuthors < 4 ? 'Participacao concentrada' : 'Distribuicao saudavel',
        forecast30d: Math.round((interactions || ava.kpis.submissions || 1) * 1.18),
        actions: [
          'Promover cases de portfolio com maior potencial profissional.',
          'Ativar desafios por curso para elevar publicacoes verificaveis.',
          'Priorizar alunos com curriculo e projeto conectado a stack real.',
        ],
      },
      modelGuidance: {
        entities: ['person', 'post', 'comment', 'course', 'activity', 'submission', 'portfolio-item', 'resume'],
        relationships: ['authorship', 'course-enrollment', 'activity-submission', 'portfolio-publication', 'skill-evidence'],
        indexes: ['username', 'post-id', 'creation-timestamp', 'course-id', 'portfolio-id'],
        normalization: 'Manter eventos sociais, academicos e portfolio em entidades separadas; gerar agregados por API/cache para BI.',
      },
    });
  } catch (err) {
    console.error('[admin power bi]', err);
    res.status(500).json({ error: 'Erro ao carregar Power BI interno' });
  }
});

export default router;
