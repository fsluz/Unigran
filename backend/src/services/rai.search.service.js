const MAX_RESULTS = 4;

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function searchConfig() {
  const apiKey = process.env.TAVILY_API_KEY || '';
  return {
    apiKey,
    enabled: enabled(process.env.RAI_WEB_SEARCH_ENABLED) && Boolean(apiKey),
  };
}

function includesPrivatePortalContext(prompt) {
  return /(minha|minhas|meu|meus|nota|frequencia|presenca|matricula|turma|sala|professor|coordenador|portal|ava|instituicao)/.test(normalize(prompt));
}

function includesPublicResearchRequest(prompt) {
  return /(pesquis|google|internet|web|fonte|referencia|artigo|noticia|atual|recente|conceito|o que e|como funciona)/.test(normalize(prompt));
}

function shouldSearch({ prompt, intent, requested }) {
  if (!requested) return false;
  if (includesPrivatePortalContext(prompt) && !includesPublicResearchRequest(prompt)) return false;
  return includesPublicResearchRequest(prompt) || ['explanation', 'summary', 'content', 'challenge'].includes(intent);
}

export async function searchRaiPublicWeb({ prompt, intent, requested }) {
  if (!shouldSearch({ prompt, intent, requested })) {
    return { status: 'skipped', sources: [] };
  }

  const config = searchConfig();
  if (!config.enabled) {
    return { status: 'not_configured', sources: [] };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.RAI_WEB_SEARCH_TIMEOUT_MS || 10000));
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: String(prompt || '').trim().slice(0, 300),
        topic: 'general',
        country: 'brazil',
        search_depth: 'basic',
        max_results: MAX_RESULTS,
        include_answer: false,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.detail?.error || data?.error || `Tavily Search HTTP ${response.status}`);
    return {
      status: 'searched',
      sources: (data.results || []).slice(0, MAX_RESULTS).map((item, index) => ({
        type: 'web',
        id: `web-${index + 1}`,
        title: item.title,
        url: item.url,
        snippet: item.content,
        displayLink: (() => {
          try {
            return new URL(item.url).hostname;
          } catch {
            return item.url;
          }
        })(),
      })),
    };
  } catch (error) {
    console.error('[RAi web search]', error.message);
    return { status: 'unavailable', sources: [] };
  } finally {
    clearTimeout(timeout);
  }
}
