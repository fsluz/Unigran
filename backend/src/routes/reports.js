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

export default router;
