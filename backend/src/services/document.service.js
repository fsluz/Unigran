const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_DOCUMENTS_BUCKET || 'ava-entregas';

function supabaseBaseUrl() {
  try {
    return new URL(SUPABASE_URL).origin;
  } catch {
    return String(SUPABASE_URL || '').replace(/\/$/, '');
  }
}

function extensionFromName(name = '') {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match ? match[1] : 'bin';
}

export function isSupabaseDocumentsConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY && SUPABASE_BUCKET);
}

export async function uploadDocumentBuffer({ file, user, folder = 'submissions' }) {
  if (!file?.buffer) {
    const err = new Error('Arquivo obrigatorio');
    err.statusCode = 400;
    throw err;
  }

  if (!isSupabaseDocumentsConfigured()) {
    const err = new Error('Supabase Storage nao configurado. Defina SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_DOCUMENTS_BUCKET.');
    err.statusCode = 503;
    throw err;
  }

  const safeUser = String(user?.username || user?.id || 'anon').replace(/[^a-z0-9_-]/gi, '-');
  const ext = extensionFromName(file.originalname);
  const storagePath = `${folder}/${safeUser}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const baseUrl = supabaseBaseUrl();
  const uploadUrl = `${baseUrl}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${storagePath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      apikey: SUPABASE_SERVICE_KEY,
      'Content-Type': file.mimetype || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file.buffer,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    let message = detail || 'Falha ao enviar documento para o Supabase';
    try {
      const parsed = JSON.parse(detail);
      if (parsed?.error === 'TenantNotFound' || parsed?.message?.includes('Missing tenant config')) {
        message = 'Supabase retornou TenantNotFound. Verifique se SUPABASE_URL esta exatamente igual ao Project URL em Project Settings > API (ex: https://PROJECT_REF.supabase.co) e reinicie o backend.';
      } else if (parsed?.message) {
        message = parsed.message;
      }
    } catch {
      if (detail.includes('TenantNotFound') || detail.includes('Missing tenant config')) {
        message = 'Supabase retornou TenantNotFound. Verifique se SUPABASE_URL esta exatamente igual ao Project URL em Project Settings > API (ex: https://PROJECT_REF.supabase.co) e reinicie o backend.';
      }
    }
    const err = new Error(message);
    err.statusCode = response.status;
    throw err;
  }

  return {
    url: `${baseUrl}/storage/v1/object/public/${SUPABASE_BUCKET}/${storagePath}`,
    storage: 'supabase',
    bucket: SUPABASE_BUCKET,
    path: storagePath,
    name: file.originalname || storagePath.split('/').pop(),
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.size || file.buffer.length,
  };
}
