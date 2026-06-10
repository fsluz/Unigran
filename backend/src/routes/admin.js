import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auth, normalizeRole } from '../middleware/auth.js';
import { hasPermission, requirePermission } from '../modules/auth/rbac.js';
import { encodeHash, readQuery, typeqlLiteral, writeQuery } from '../db/typedb.js';
import { auditLog, readAuditLogs } from '../services/audit.service.js';
import { getAvaPowerBiSnapshot } from '../modules/academic/typedbAvaStore.js';
import { mlBiDashboard, mlHealth as fetchMlHealth } from '../modules/ml/mlPythonClient.js';

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
    const { invalidateRoleCache } = await import('../middleware/auth.js');
    invalidateRoleCache(req.params.username);
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

router.get('/debug/post/:id', requirePermission('posts:moderate'), async (req, res) => {
  try {
    const rows = await readQuery(`
      match
        $post isa post, has post-id "${typeqlLiteral(req.params.id)}";
      fetch { "attrs": $post.* };
    `);
    const attrs = (rows && rows[0] && rows[0].attrs) ? rows[0].attrs : {};
    res.json({ attrs });
  } catch (err) {
    console.error('[admin debug post attrs]', err);
    res.status(500).json({ error: 'Falha ao buscar atributos do post' });
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
    const { logs, total } = await readAuditLogs({ category, action, actor, level, from, to, limit });

    auditLog({ action: 'AUDIT_LOGS_ACCESSED', category: 'ADMIN', actor: req.user?.username, ip: getIp(req) });
    res.json({ logs, total });
  } catch (err) {
    console.error('[audit-logs]', err);
    res.status(500).json({ error: 'Erro ao ler logs' });
  }
});

router.get('/power-bi', requirePermission('system:manage'), async (req, res) => {
  try {
    const [ava, typedbUsers, typedbPosts, typedbComments, typedbReactions, typedbMlJobs, mlBi] = await Promise.all([
      getAvaPowerBiSnapshot(),
      readQuery(`
        match $u isa person, has username $username;
        try { $u has name $name; }; try { $u has user-role $role; };
        try { $u has gender $gender; }; try { $u has can-publish $can_publish; };
        fetch { "username": $username, "name": $name, "role": $role, "gender": $gender, "can_publish": $can_publish };
      `).catch(() => []),
      readQuery(`
        match $p isa post, has post-id $id;
        try { $p has creation-timestamp $created_at; }; try { $p has language $lang; };
        try { $p has portfolio-id $portfolio_id; }; try { $p has tag $tag; };
        try { $p has post-visibility $visibility; };
        fetch { "id": $id, "created_at": $created_at, "lang": $lang, "portfolio_id": $portfolio_id, "tag": $tag, "visibility": $visibility };
      `).catch(() => []),
      readQuery(`
        match $c isa comment, has comment-id $id; try { $c has creation-timestamp $created_at; };
        fetch { "id": $id, "created_at": $created_at };
      `).catch(() => []),
      readQuery(`
        match $r isa reaction, has emoji $emoji; try { $r has creation-timestamp $created_at; };
        fetch { "emoji": $emoji, "created_at": $created_at };
      `).catch(() => []),
      readQuery(`
        match $j isa ml-job, has ml-id $id; try { $j has ml-status $status; };
        try { $j has ml-work-model $model; }; try { $j has ml-seniority $seniority; };
        try { $j has ml-match-pct $match; }; try { $j has ml-source $source; };
        fetch { "id": $id, "status": $status, "model": $model, "seniority": $seniority, "match": $match, "source": $source };
      `).catch(() => []),
      mlBiDashboard().catch(() => null),
    ]);

    // ── Cálculos sociais ──────────────────────────────────────────────────────
    const socialPosts       = typedbPosts.length;
    const portfolioPosts    = typedbPosts.filter(p => p.portfolio_id).length;
    const activeAuthors     = new Set([...ava.submissions.map(s => s.username), ...ava.portfolio.map(p => p.username)]).size;
    const interactions      = typedbComments.length + ava.kpis.submissions + ava.kpis.completedMaterials;
    const engagementPerPost = socialPosts ? Number((interactions / socialPosts).toFixed(1)) : 0;
    const conversion        = ava.kpis.submissions ? Math.round((ava.kpis.portfolioItems / ava.kpis.submissions) * 100) : 0;

    // ── Posts por hora (0-23) ─────────────────────────────────────────────────
    const hourCounts = Array(24).fill(0);
    for (const p of typedbPosts) {
      const ts = p.created_at;
      if (ts) { try { hourCounts[new Date(ts).getHours()]++; } catch {} }
    }
    const postsPerHour = hourCounts.map((count, hour) => ({ hour, count }));

    // ── Posts por dia (últimos 30d) ───────────────────────────────────────────
    const dayMap = {};
    const now = Date.now();
    for (const p of typedbPosts) {
      if (!p.created_at) continue;
      try {
        const d = new Date(p.created_at);
        if (now - d.getTime() > 30 * 86400000) continue;
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = (dayMap[key] || 0) + 1;
      } catch {}
    }
    const postsPerDay = Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

    // ── Top tags ──────────────────────────────────────────────────────────────
    const tagMap = {};
    for (const p of typedbPosts) { if (p.tag) tagMap[p.tag] = (tagMap[p.tag] || 0) + 1; }
    const topTags = Object.entries(tagMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([tag, count]) => ({ tag, count }));

    // ── Visibilidade ──────────────────────────────────────────────────────────
    const visMap = { public: 0, private: 0, default: 0 };
    for (const p of typedbPosts) { const v = p.visibility || 'default'; visMap[v] = (visMap[v] || 0) + 1; }

    // ── Idiomas ───────────────────────────────────────────────────────────────
    const langMap = {};
    for (const p of typedbPosts) { const l = p.lang || 'pt-BR'; langMap[l] = (langMap[l] || 0) + 1; }
    const byLanguage = Object.entries(langMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([lang, count]) => ({ lang, count }));

    // ── Pessoas ───────────────────────────────────────────────────────────────
    const genderMap = { male: 0, female: 0, other: 0 };
    const roleMap   = {};
    for (const u of typedbUsers) {
      const g = u.gender || 'other'; genderMap[g] = (genderMap[g] || 0) + 1;
      const r = u.role || 'user'; roleMap[r] = (roleMap[r] || 0) + 1;
    }
    const byRole = Object.entries(roleMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([role, count]) => ({ role, count }));

    // ── Reações ───────────────────────────────────────────────────────────────
    const emojiMap = {};
    for (const r of typedbReactions) { if (r.emoji) emojiMap[r.emoji] = (emojiMap[r.emoji] || 0) + 1; }
    const byEmoji = Object.entries(emojiMap).map(([emoji, count]) => ({ emoji, count }));

    // ── Vagas ML ──────────────────────────────────────────────────────────────
    const vagasTotal  = typedbMlJobs.length;
    const vagasSaved  = typedbMlJobs.filter(j => j.status === 'saved').length;
    const vagasApplied = typedbMlJobs.filter(j => j.status === 'applied').length;
    const matchValues = typedbMlJobs.map(j => Number(j.match)).filter(Boolean);
    const avgMatch    = matchValues.length ? Number((matchValues.reduce((a, b) => a + b, 0) / matchValues.length).toFixed(1)) : 0;
    const modelMap    = {};
    for (const j of typedbMlJobs) { const m = j.model || 'N/D'; modelMap[m] = (modelMap[m] || 0) + 1; }
    const seniorityMap = {};
    for (const j of typedbMlJobs) { const s = j.seniority || 'N/D'; seniorityMap[s] = (seniorityMap[s] || 0) + 1; }

    // ── Python ML health via mlPythonClient (mesma URL de mlRoutes) ──
    let mlHealth = await fetchMlHealth().catch(() => ({ status: 'unavailable', models_loaded: false }));

    auditLog({ action: 'POWER_BI_ACCESSED', category: 'ADMIN', actor: req.user?.username, ip: getIp(req) });

    res.json({
      generatedAt: new Date().toISOString(),
      kpis: {
        users: typedbUsers.length || ava.dimensions.students,
        activeAuthors,
        socialPosts,
        comments: typedbComments.length,
        reactions: typedbReactions.length,
        interactions,
        engagementPerPost,
        portfolioItems: ava.kpis.portfolioItems,
        resumes: ava.kpis.resumes,
        submissions: ava.kpis.submissions,
        averageProgress: ava.kpis.averageProgress,
        portfolioConversion: conversion,
        portfolioPosts,
        vagasTotal,
        vagasSaved,
        vagasApplied,
        avgMatch,
      },
      social: { postsPerHour, postsPerDay, topTags, byVisibility: visMap, byLanguage },
      people: { list: typedbUsers.slice(0, 30), byGender: genderMap, byRole },
      engagement: { byEmoji },
      vagas: {
        total: vagasTotal,
        saved: vagasSaved,
        applied: vagasApplied,
        avgMatch,
        byModel: Object.entries(modelMap).map(([model, count]) => ({ model, count })),
        bySeniority: Object.entries(seniorityMap).map(([seniority, count]) => ({ seniority, count })),
      },
      ml: {
        health: mlHealth,
        avgMatch,
        por_area: mlBi?.por_area ?? [],
        clusters: mlBi?.clusters ?? [],
        explicacao_clusters: mlBi?.explicacao_clusters ?? [],
        top_skills: mlBi?.top_skills ?? [],
        metricas_modelo: mlBi?.metricas_modelo ?? {},
        resumo_geral: mlBi?.resumo_geral ?? {},
        vagas_em_memoria: mlBi?.vagas_em_memoria ?? 0,
      },
      courses: ava.byCourse,
      recentPortfolio: ava.portfolio,
      recentSubmissions: ava.submissions,
      rai: {
        signal: engagementPerPost > 18 ? 'Rede aquecida' : engagementPerPost > 8 ? 'Ritmo saudavel' : 'Precisa ativacao',
        risk: activeAuthors < 4 ? 'Participacao concentrada' : 'Distribuicao saudavel',
        forecast30d: Math.round((interactions || ava.kpis.submissions || 1) * 1.18),
        watchlist: [
          activeAuthors < 5   ? { level: 'red',    msg: 'Menos de 5 autores ativos — baixo engajamento'         } : null,
          engagementPerPost < 2 ? { level: 'yellow', msg: 'Taxa de engajamento abaixo de 2 interações/post'       } : null,
          conversion < 20     ? { level: 'yellow', msg: `Conversão submissão→portfólio em ${conversion}% (meta: 30%)` } : null,
          ava.kpis.resumes < 3  ? { level: 'yellow', msg: 'Poucos currículos cadastrados na plataforma'           } : null,
        ].filter(Boolean),
        actions: [
          'Promover cases de portfolio com maior potencial profissional.',
          'Ativar desafios por curso para elevar publicacoes verificaveis.',
          'Priorizar alunos com curriculo e projeto conectado a stack real.',
        ],
      },
    });
  } catch (err) {
    console.error('[admin power bi]', err);
    res.status(500).json({ error: 'Erro ao carregar Power BI interno' });
  }
});

router.get('/posts/by-author', requirePermission('users:platform_manage'), async (req, res) => {
  try {
    // Mesma query do overview para contar posts — só post-id, sem depender de posting
    const [allPostRows, authorRows] = await Promise.all([
      readQuery(`
        match $p isa post, has post-id $id;
        fetch { "id": $id };
      `).catch(() => []),
      readQuery(`
        match
          $post isa post, has post-id $post_id;
          posting(post: $post, page: $user);
          $user isa person, has username $username;
          try { $user has name $name; };
        fetch {
          "username": $username,
          "name": $name,
          "post_id": $post_id
        };
      `).catch(() => []),
    ]);

    const totalPosts = new Set(allPostRows.map(r => r.id).filter(Boolean)).size;

    // Deduplica por post_id+username para evitar múltiplas linhas do mesmo post
    const seen   = new Set();
    const counts = {};
    for (const row of authorRows) {
      const key      = row.username || 'desconhecido';
      const dedupKey = `${key}::${row.post_id}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      if (!counts[key]) {
        counts[key] = {
          name: row.name || row.username || 'Desconhecido',
          username: row.username || null,
          count: 0,
        };
      }
      counts[key].count += 1;
    }

    const authors        = Object.values(counts).sort((a, b) => b.count - a.count);
    const countedTotal   = authors.reduce((s, a) => s + a.count, 0);
    const orphanCount    = totalPosts - countedTotal; // posts sem autor linkado

    // Se houver posts sem autor, aparece como entrada separada
    if (orphanCount > 0) {
      authors.push({ name: 'Sem autor identificado', username: null, count: orphanCount });
    }

    res.json({ authors, totalPosts });
  } catch (err) {
    console.error('[admin posts by-author]', err);
    res.status(500).json({ error: 'Erro ao carregar posts por autor' });
  }
});

export default router;