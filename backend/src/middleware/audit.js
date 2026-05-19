import { auditLog } from '../services/audit.service.js';

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

function categoryFromPath(path) {
  if (path.startsWith('/api/auth')) return 'AUTH';
  if (path.startsWith('/api/admin')) return 'ADMIN';
  if (path.includes('/privacy') || path.includes('/follow')) return 'PRIVACY';
  return 'DATA';
}

function actionFromRequest(req) {
  const route = req.originalUrl.split('?')[0]
    .replace(/^\/api\//, '')
    .replace(/\/[0-9a-f-]{8,}/gi, '/:id')
    .replace(/\/@?[^/]+/g, part => (part.includes(':') ? part : part));
  return `${req.method}_${route}`.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function shouldSkip(req) {
  if (req.method === 'GET' || req.method === 'OPTIONS') return true;
  if (req.originalUrl.includes('/audit-logs')) return true;
  if (req.originalUrl.includes('/online/heartbeat')) return true;
  if (req.originalUrl.includes('/typing')) return true;
  if (req.originalUrl.includes('/auth/login')) return true;
  if (req.originalUrl.includes('/auth/register')) return true;
  return false;
}

export function auditRequests(req, res, next) {
  if (shouldSkip(req)) return next();

  res.on('finish', () => {
    const status = res.statusCode;
    const failed = status >= 400;
    auditLog({
      action: actionFromRequest(req),
      category: categoryFromPath(req.originalUrl),
      actor: req.user?.username || 'anonymous',
      target: req.params?.username || req.params?.id || req.params?.convId || null,
      ip: getIp(req),
      level: status >= 500 ? 'ALERT' : failed ? 'WARN' : 'INFO',
      meta: {
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status,
      },
    });
  });

  next();
}
