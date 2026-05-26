function cleanEnv(value = '') {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function supabaseConfig() {
  return {
    url: cleanEnv(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    key: cleanEnv(
      process.env.SUPABASE_SERVICE_ROLE_KEY
      || process.env.SUPABASE_SERVICE_KEY
      || process.env.SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    bucket: cleanEnv(process.env.SUPABASE_DOCUMENTS_BUCKET || 'ava-entregas'),
  };
}

function supabaseBaseUrl() {
  const { url } = supabaseConfig();
  try {
    return new URL(url).origin;
  } catch {
    return String(url || '').replace(/\/$/, '');
  }
}

function extensionFromName(name = '') {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match ? match[1] : 'bin';
}

export function isSupabaseDocumentsConfigured() {
  const { url, key, bucket } = supabaseConfig();
  return Boolean(url && key && bucket);
}

export async function uploadDocumentBuffer({ file, user, folder = 'submissions' }) {
  if (!file?.buffer) {
    const err = new Error('Arquivo obrigatorio');
    err.statusCode = 400;
    throw err;
  }

  if (!isSupabaseDocumentsConfigured()) {
    const { url, key, bucket } = supabaseConfig();
    const missing = [
      !url && 'SUPABASE_URL',
      !key && 'SUPABASE_SERVICE_ROLE_KEY',
      !bucket && 'SUPABASE_DOCUMENTS_BUCKET',
    ].filter(Boolean).join(', ');
    const err = new Error(`Supabase Storage nao configurado. Falta: ${missing}. Defina no projeto backend da Vercel.`);
    err.statusCode = 503;
    throw err;
  }

  const safeUser = String(user?.username || user?.id || 'anon').replace(/[^a-z0-9_-]/gi, '-');
  const ext = extensionFromName(file.originalname);
  const { key, bucket } = supabaseConfig();
  const storagePath = `${folder}/${safeUser}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const baseUrl = supabaseBaseUrl();
  const uploadUrl = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${storagePath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
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
    url: `${baseUrl}/storage/v1/object/public/${bucket}/${storagePath}`,
    storage: 'supabase',
    bucket,
    path: storagePath,
    name: file.originalname || storagePath.split('/').pop(),
    mimeType: file.mimetype || 'application/octet-stream',
    size: file.size || file.buffer.length,
  };
}

export async function deleteDocumentObject({ storage, path }) {
  if (storage !== 'supabase' || !path) return false;
  if (!isSupabaseDocumentsConfigured()) {
    const err = new Error('Supabase Storage nao configurado para excluir documento.');
    err.statusCode = 503;
    throw err;
  }
  const { key, bucket } = supabaseConfig();
  const baseUrl = supabaseBaseUrl();
  const response = await fetch(`${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
  });
  if (!response.ok) {
    const err = new Error(await response.text().catch(() => 'Falha ao excluir documento do Supabase'));
    err.statusCode = response.status;
    throw err;
  }
  return true;
}
