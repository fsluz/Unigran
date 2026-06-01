import { Router } from "express";
import { auth } from '../middleware/auth.js';
import { requirePermission } from '../modules/auth/rbac.js';
import { readQuery } from '../db/typedb.js'
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const router = Router();
router.use(auth);
router.use(requirePermission('system:manage'));

let pool = null;
function getPool() {
    if (!pool && process.env.DB_HOST) {
        pool = new Pool({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'postgres',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: { rejectUnauthorized: false },
            max: 3,
        });
    }
    return pool;
}

// GET /api/admin/reports/overview
router.get('/overview', async (req, res) => {
    try {
        // Dados do TypeDB
        const [usersRows, postsRows, communitiesRows] = await Promise.allSettled([
            readQuery(`
                match $u isa person, has username $username;
                try { $u has user-role $role; };
                try { $u has is-banned $banned; };
                try { $u has two-factor-enabled $twofa; };
                fetch { "username": $username, "role": $role, "banned": $banned, "twofa": $twofa };
            `),
            readQuery(`
                match $p isa post, has post-id $id;
                fetch { "id": $id };
            `),
            readQuery(`
                match $g isa group, has group-id $gid;
                fetch { "gid": $gid };
            `),
        ]);

        // FIX: usersRows.status era comparado incorretamente
        const users        = usersRows.status        === 'fulfilled' ? usersRows.value        : [];
        const posts        = postsRows.status        === 'fulfilled' ? postsRows.value        : [];
        const communities  = communitiesRows.status  === 'fulfilled' ? communitiesRows.value  : [];

        const totalUsers  = users.length;
        const bannedUsers = users.filter(u => u.banned === true || String(u.banned).toLowerCase() === 'true').length;
        const twoFaUsers  = users.filter(u => u.twofa  === true || String(u.twofa ).toLowerCase() === 'true').length;

        const roleCounts = users.reduce((acc, u) => {
            const role = u.role || 'user';
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {});
        const roleChart = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));

        // Dados do Supabase (audit_logs)
        const db = getPool();
        let security = { loginSuccess: 0, loginFailed: 0, loginBlocked: 0, passwordResets: 0 };
        let actionsPerDay      = [];
        let categoryBreakdown  = [];
        let levelBreakdown     = [];
        let topActions         = [];
        let errorRate          = [];

        if (db) {
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

            const [secRes, dailyRes, catRes, levelRes, topActRes, errorRes] = await Promise.allSettled([
                // Segurança: logins e resets
                db.query(`
                    SELECT action, COUNT(*)::int as count
                    FROM audit_logs
                    WHERE timestamp >= $1
                      AND action IN ('LOGIN_SUCCESS','LOGIN_FAILED','LOGIN_BLOCKED','PASSWORD_RESET_REQUESTED')
                    GROUP BY action
                `, [since]),

                // Ações por dia (últimos 14 dias)
                db.query(`
                    SELECT DATE(timestamp) as day, COUNT(*)::int as total
                    FROM audit_logs
                    WHERE timestamp >= NOW() - INTERVAL '14 days'
                    GROUP BY DATE(timestamp)
                    ORDER BY day ASC
                `),

                // Breakdown por categoria (últimos 30 dias)
                db.query(`
                    SELECT category, COUNT(*)::int as count
                    FROM audit_logs
                    WHERE timestamp >= $1
                    GROUP BY category
                    ORDER BY count DESC
                `, [since]),

                // Breakdown por nível (últimos 30 dias)
                db.query(`
                    SELECT level, COUNT(*)::int as count
                    FROM audit_logs
                    WHERE timestamp >= $1
                    GROUP BY level
                    ORDER BY count DESC
                `, [since]),

                // Top 5 ações mais frequentes (últimos 30 dias)
                db.query(`
                    SELECT action, COUNT(*)::int as count
                    FROM audit_logs
                    WHERE timestamp >= $1
                    GROUP BY action
                    ORDER BY count DESC
                    LIMIT 5
                `, [since]),

                // Taxa de erros por dia (status 4xx/5xx nos últimos 14 dias)
                db.query(`
                    SELECT DATE(timestamp) as day,
                           COUNT(*) FILTER (WHERE level IN ('WARN','ALERT'))::int as errors,
                           COUNT(*)::int as total
                    FROM audit_logs
                    WHERE timestamp >= NOW() - INTERVAL '14 days'
                    GROUP BY DATE(timestamp)
                    ORDER BY day ASC
                `),
            ]);

            if (secRes.status === 'fulfilled') {
                for (const row of secRes.value.rows) {
                    if (row.action === 'LOGIN_SUCCESS')              security.loginSuccess   = row.count;
                    if (row.action === 'LOGIN_FAILED')               security.loginFailed    = row.count;
                    // FIX: 'LOGIN-BLOKED' -> 'LOGIN_BLOCKED'
                    if (row.action === 'LOGIN_BLOCKED')              security.loginBlocked   = row.count;
                    if (row.action === 'PASSWORD_RESET_REQUESTED')   security.passwordResets = row.count;
                }
            }

            if (dailyRes.status === 'fulfilled') {
                const map = {};
                for (const row of dailyRes.value.rows) {
                    map[row.day.toISOString().slice(0, 10)] = row.total;
                }
                for (let i = 13; i >= 0; i--) {
                    const d   = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                    const key = d.toISOString().slice(0, 10);
                    actionsPerDay.push({
                        day:   d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                        total: map[key] || 0,
                    });
                }
            }

            if (catRes.status === 'fulfilled') {
                // FIX: .row -> .rows
                categoryBreakdown = catRes.value.rows.map(r => ({ name: r.category, value: r.count }));
            }

            if (levelRes.status === 'fulfilled') {
                levelBreakdown = levelRes.value.rows.map(r => ({ name: r.level, value: r.count }));
            }

            if (topActRes.status === 'fulfilled') {
                topActions = topActRes.value.rows.map(r => ({ action: r.action, count: r.count }));
            }

            if (errorRes.status === 'fulfilled') {
                const map = {};
                for (const row of errorRes.value.rows) {
                    map[row.day.toISOString().slice(0, 10)] = { errors: row.errors, total: row.total };
                }
                for (let i = 13; i >= 0; i--) {
                    const d   = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                    const key = d.toISOString().slice(0, 10);
                    const val = map[key] || { errors: 0, total: 0 };
                    errorRate.push({
                        day:    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                        errors: val.errors,
                        total:  val.total,
                    });
                }
            }
        }

        // FIX: twoDaUsers -> twoFaUsers
        res.json({
            overview: {
                totalUsers,
                totalPosts:       posts.length,
                totalCommunities: communities.length,
                bannedUsers,
                twoFaUsers,
            },
            security,
            roleChart,
            actionsPerDay,
            categoryBreakdown,
            levelBreakdown,
            topActions,
            errorRate,
        });
    } catch (err) {
        console.error('[reports/overview]', err);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

// GET /api/admin/reports/success-logins
router.get('/success-logins', async (req, res) => {
    try {
        const db = getPool();
        if (!db) return res.json({ logins: [] });

        const { limit = 50, offset = 0 } = req.query;
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const result = await db.query(`
            SELECT id, timestamp, actor, ip, meta
            FROM audit_logs
            WHERE action = 'LOGIN_SUCCESS'
              AND timestamp >= $1
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3
        `, [since, parseInt(limit), parseInt(offset)]);

        const countResult = await db.query(`
            SELECT COUNT(*)::int as total
            FROM audit_logs
            WHERE action = 'LOGIN_SUCCESS'
              AND timestamp >= $1
        `, [since]);

        res.json({
            logins: result.rows,
            total: countResult.rows[0]?.total || 0,
        });
    } catch (err) {
        console.error('[reports/success-logins]', err);
        res.status(500).json({ error: 'Erro ao buscar logins bem-sucedidos' });
    }
});

// GET /api/admin/reports/password-resets
router.get('/password-resets', async (req, res) => {
    try {
        const db = getPool();
        if (!db) return res.json({ resets: [] });

        const { limit = 100, offset = 0 } = req.query;
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const result = await db.query(`
            SELECT id, timestamp, actor, target, ip, meta, action
            FROM audit_logs
            WHERE action IN (
                'PASSWORD_RESET_REQUESTED',
                'PASSWORD_RESET_CODE_INVALID',
                'PASSWORD_RESET_CODE_VERIFIED',
                'PASSWORD_RESET_COMPLETED'
            )
              AND timestamp >= $1
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3
        `, [since, parseInt(limit), parseInt(offset)]);

        const countResult = await db.query(`
            SELECT COUNT(*)::int as total
            FROM audit_logs
            WHERE action IN (
                'PASSWORD_RESET_REQUESTED',
                'PASSWORD_RESET_CODE_INVALID',
                'PASSWORD_RESET_CODE_VERIFIED',
                'PASSWORD_RESET_COMPLETED'
            )
              AND timestamp >= $1
        `, [since]);

        res.json({
            resets: result.rows,
            total: countResult.rows[0]?.total || 0,
        });
    } catch (err) {
        console.error('[reports/password-resets]', err);
        res.status(500).json({ error: 'Erro ao buscar resets de senha' });
    }
});

// GET /api/admin/reports/failed-logins
router.get('/failed-logins', async (req, res) => {
    try {
        const db = getPool();
        if (!db) return res.json({ logins: [] });

        const { limit = 50, offset = 0 } = req.query;
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const result = await db.query(`
            SELECT id, timestamp, actor, ip, meta
            FROM audit_logs
            WHERE action = 'LOGIN_FAILED'
              AND timestamp >= $1
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3
        `, [since, parseInt(limit), parseInt(offset)]);

        const countResult = await db.query(`
            SELECT COUNT(*)::int as total
            FROM audit_logs
            WHERE action = 'LOGIN_FAILED'
              AND timestamp >= $1
        `, [since]);

        res.json({
            logins: result.rows,
            total: countResult.rows[0]?.total || 0,
        });
    } catch (err) {
        console.error('[reports/failed-logins]', err);
        res.status(500).json({ error: 'Erro ao buscar logins falhos' });
    }
});

// GET /api/admin/reports/blocked-logins
router.get('/blocked-logins', async (req, res) => {
    try {
        const db = getPool();
        if (!db) return res.json({ logins: [] });

        const { limit = 50, offset = 0 } = req.query;
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        // Busca eventos de bloqueio no audit_logs
        const result = await db.query(`
            SELECT id, timestamp, actor, ip, meta
            FROM audit_logs
            WHERE action = 'LOGIN_BLOCKED'
              AND timestamp >= $1
            ORDER BY timestamp DESC
            LIMIT $2 OFFSET $3
        `, [since, parseInt(limit), parseInt(offset)]);

        const countResult = await db.query(`
            SELECT COUNT(*)::int as total
            FROM audit_logs
            WHERE action = 'LOGIN_BLOCKED'
              AND timestamp >= $1
        `, [since]);

        // Busca também tentativas após bloqueio: agrupa por IP/email
        // e conta quantas vezes tentou logar depois de estar bloqueado
        const attemptsAfterBlock = await db.query(`
            SELECT
                COALESCE(meta->>'email', actor, ip) AS identifier,
                ip,
                COUNT(*)::int AS attempts_after_block,
                MAX(timestamp) AS last_attempt
            FROM audit_logs
            WHERE action = 'LOGIN_BLOCKED'
              AND timestamp >= $1
            GROUP BY COALESCE(meta->>'email', actor, ip), ip
            ORDER BY attempts_after_block DESC, last_attempt DESC
        `, [since]);

        res.json({
            logins: result.rows,
            total: countResult.rows[0]?.total || 0,
            summary: attemptsAfterBlock.rows,
        });
    } catch (err) {
        console.error('[reports/blocked-logins]', err);
        res.status(500).json({ error: 'Erro ao buscar logins bloqueados' });
    }
});

export default router;