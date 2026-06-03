/**
 * Log estruturado para predições ML.
 * Em produção emite JSON linha a linha. Em dev emite linha legível.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

export function logPrediction({ username, endpoint, inputLength, area, score, latencyMs, source, error = null }) {
  const entry = {
    ts:           new Date().toISOString(),
    service:      'ml',
    username:     username || 'anonymous',
    endpoint,
    input_length: inputLength,
    area:         area  ?? null,
    score:        score ?? null,
    latency_ms:   latencyMs,
    source,
    ...(error && { error: String(error).slice(0, 300) }),
  };

  if (IS_PROD) {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    const ok = error ? '✗' : '✓';
    const scoreStr = score != null ? ` score=${score.toFixed(1)}%` : '';
    console.log(`[ML ${endpoint}] ${ok} user=${entry.username} area=${area || '-'}${scoreStr} src=${source || '-'} ${latencyMs}ms${error ? ` ERR=${error}` : ''}`);
  }
}
