/**
 * Serviço de Auditoria — LGPD / Logs de Segurança
 *
 * Registra todas as ações sensíveis do sistema em arquivo NDJSON
 * (uma linha JSON por evento), facilitando exportação e análise.
 *
 * Categorias de eventos registrados:
 *  - AUTH      → login, logout, registro, reset de senha, 2FA
 *  - DATA      → acesso, edição, exclusão de dados pessoais
 *  - ADMIN     → ban, cargo, restrição, resolução de denúncias
 *  - PRIVACY   → alterações de visibilidade e privacidade
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath} from 'url';

const _dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(_dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

// Garante que a pasta de logs existe
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

/**
 * Registra um evento de auditoria.
 * 
 * @param {object} params
 * @param {string} params.action     - Identificador da ação  ex: 'LOGIN_SUCCESS'
 * @param {string} params.category   - Categoria              ex: 'AUTH' | 'DATA' | 'ADMIN' | 'PRIVACY'
 * @param {string} [params.actor]    - Quem realizou          ex: username ou 'anonymous'
 * @param {string} [params.target]   - Alvo da ação           ex: username afetado
 * @param {object} [params.meta]     - Dados extras (sem senha ou dados sensíveis)
 * @param {string} [params.ip]       - IP do requisitante
 * @param {'INFO'|'WARN'|'ALERT'} [params.level] - Nível de severidade
 */

export function auditLog({ action, category, actor = 'anonymous', target = null, meta = {}, ip = null, level = 'INFO' }) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        category,
        action,
        actor,
        target,
        ip,
        meta,
    };

    const line = JSON.stringify(entry) + '\n';

    // Escrita assíncrona sem bloquear a resposta HTTP
    fs.appendFile(LOG_FILE, line, err => {
        if (err) console.error('[audit] Falha ao gravar log:', err.message);
    });

    // Também exibe no console em desenvolvimento
    if (process. env.NODE_ENV !== 'production') {
        const icon = level == 'ALERT' ? '🚨' : level === 'WARN' ? '⚠️ ' : '📋';
        console.log(`${icon} [AUDIT] ${entry.timestamp} | ${category}:${action} | actor=${actor}${target ? ` target=${target}` : ''}${ip ? ` ip=${ip}` : ''}`);
    }
}

/**
 * Retorna todos os logs como array de objetos.
 * Usado pela rota /api/admin/audit-logs.
 */

export function readAuditLogs() {
    if (!fs.existsSync(LOG_FILE)) return [];
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
    return lines.map(line => {
        try { return JSON.parse(line); }
        catch (err) {
            console.error('[audit] Linha de log inválida:', line);
            return null;
        }
    }).filter(Boolean);
}