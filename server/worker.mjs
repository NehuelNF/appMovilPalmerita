const hosts = new Set(['player.zilla-networks.com', 'animeav1.uns.bio', 'voe.sx', 'mega.nz', 'www.mp4upload.com', 'mp4upload.com', 'byselapuix.com', 'jkanime.net']);

export function validEmbed(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts.has(u.hostname); } catch { return false; }
}

export function extractPlayers(html) {
  const players = [];
  const add = (url, name, audio = 'sub') => {
    url = url.replaceAll('&amp;', '&');
    if (/hls/i.test(name) || /zilla-networks/i.test(url)) name = 'HLS';
    if (validEmbed(url) && !players.some(p => p.url === url && p.audio === audio)) {
      players.push({ url, name, audio, provider: 'animeav1' });
    }
  };

  // 1. Extraer secciones estructuradas SUB y DUB si existen
  // Se busca preferentemente dentro del bloque de embeds si existe
  const embedsMatch = html.match(/embeds\s*:\s*\{([\s\S]*?)\}(?:,\s*[a-zA-Z0-9_]+\s*:|$)/i);
  const searchScope = embedsMatch ? embedsMatch[1] : html;

  let foundStructured = false;
  for (const match of searchScope.matchAll(/\b(SUB|DUB)\s*:\s*\[([\s\S]*?)\]/gi)) {
    foundStructured = true;
    const audio = match[1].toLowerCase();
    const content = match[2];
    for (const m of content.matchAll(/\{server:"([^"<>]{1,40})",url:"(https:\/\/[^"<>]+)"\}/g)) {
      if (/\/e\/|\/embed[/-]|\/play\/|uns\.bio\/#/.test(m[2])) add(m[2], m[1], audio);
    }
  }

  // 2. Fallback genérico si no hubo bloques SUB/DUB
  if (!foundStructured || players.length === 0) {
    for (const m of html.matchAll(/\{server:"([^"<>]{1,40})",url:"(https:\/\/[^"<>]+)"\}/g)) {
      if (/\/e\/|\/embed[/-]|\/play\/|uns\.bio\/#/.test(m[2])) add(m[2], m[1], 'sub');
    }
  }

  return players;
}

export function extractDirectVideo(html) {
  const match = html.match(/\bsrc\s*:\s*["'](https:\/\/[^"']+\/video\.mp4(?:\?[^"']*)?)["']/i);
  if (!match) return null;
  try {
    const url = new URL(match[1].replaceAll('&amp;', '&'));
    if (url.protocol !== 'https:' || !/(^|\.)mp4upload\.com$/i.test(url.hostname) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
export function extractMediaEpisodes(html, slug) {
  const pattern = new RegExp(`(?:/media/${slug}/|/ver/${slug}-|/ver/${slug}/)(\\d+)`, 'gi');
  const episodes = new Set();
  for (const m of html.matchAll(pattern)) {
    const epNum = parseInt(m[1], 10);
    if (epNum > 0 && epNum < 10000) episodes.add(epNum);
  }
  return Array.from(episodes).sort((a, b) => a - b);
}

export function extractJkPlayers(html) {
  const players = [];
  const serverNames = {};
  for (const m of html.matchAll(/<a\b[^>]*\bdata-id=["'](\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const name = m[2].replace(/<[^>]*>/g, '').trim();
    if (name) serverNames[m[1]] = name;
  }
  for (const m of html.matchAll(/video\[(\d+)\]\s*=\s*['"]<iframe[^>]*\bsrc=["']([^"']+)["'][^>]*><\/iframe>['"]/gi)) {
    const id = m[1];
    const url = m[2].replaceAll('&amp;', '&');
    if (validEmbed(url)) {
      const serverLabel = serverNames[id] || `Servidor ${parseInt(id, 10) + 1}`;
      players.push({
        name: `${serverLabel} (JK)`,
        url,
        type: 'iframe',
        audio: 'sub',
        provider: 'jkanime'
      });
    }
  }
  return players;
}

export async function fetchAnimeAv1Media(slug, fetcher = fetch) {
  const sourceUrl = `https://animeav1.com/media/${slug}`;
  try {
    const response = await fetcher(sourceUrl, {redirect:'manual', signal:AbortSignal.timeout(12000), headers:{Accept:'text/html'}});
    if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
      const text = await response.text();
      const availableEpisodes = extractMediaEpisodes(text, slug);
      if (availableEpisodes.length > 0) {
        return { slug, availableEpisodes, count: availableEpisodes.length, exists: true, provider: 'animeav1', sourceUrl };
      }
    }
  } catch { /* ignore */ }
  return { slug, availableEpisodes: [], count: 0, exists: false, provider: 'animeav1', sourceUrl };
}

export async function fetchJkMedia(slug, fetcher = fetch) {
  const jkUrl = `https://jkanime.net/${slug}/`;
  try {
    const jkRes = await fetcher(jkUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (jkRes.ok) {
      const jkText = await jkRes.text();
      if (!jkText.includes('Página no encontrada') && !jkText.includes('404 Not Found')) {
        const epMatch = jkText.match(/<span>Episodios:<\/span>\s*(\d+)/i);
        const tipoMatch = jkText.match(/<span>Tipo:<\/span>\s*([^<\n\r]+)/i);
        const isMovie = tipoMatch && /pelicula|movie/i.test(tipoMatch[1]);
        let count = epMatch ? parseInt(epMatch[1], 10) : 0;
        if (isMovie && count === 0) count = 1;
        if (count > 0) {
          const availableEpisodes = Array.from({length: count}, (_, i) => i + 1);
          return { slug, availableEpisodes, count, exists: true, provider: 'jkanime', sourceUrl: jkRes.url || jkUrl };
        }
      }
    }
  } catch { /* ignore */ }
  return { slug, availableEpisodes: [], count: 0, exists: false, provider: 'jkanime', sourceUrl: jkUrl };
}

export async function resolveMedia(request, fetcher = fetch) {
  const q = new URL(request.url).searchParams;
  const slug = q.get('slug') || '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) return json({error:'Slug no válido.'},400);

  const [av1Res, jkRes] = await Promise.allSettled([
    fetchAnimeAv1Media(slug, fetcher),
    fetchJkMedia(slug, fetcher)
  ]);

  const av1 = av1Res.status === 'fulfilled' ? av1Res.value : { exists: false, availableEpisodes: [] };
  const jk = jkRes.status === 'fulfilled' ? jkRes.value : { exists: false, availableEpisodes: [] };

  const providers = [];
  if (av1.exists) providers.push('animeav1');
  if (jk.exists) providers.push('jkanime');

  if (providers.length > 0) {
    const epSet = new Set([...(av1.availableEpisodes || []), ...(jk.availableEpisodes || [])]);
    const availableEpisodes = Array.from(epSet).sort((a, b) => a - b);
    const sourceUrl = av1.exists ? av1.sourceUrl : jk.sourceUrl;
    return json({
      slug,
      availableEpisodes,
      count: availableEpisodes.length,
      exists: true,
      provider: providers.length > 1 ? 'both' : providers[0],
      providers,
      sourceUrl
    });
  }

  return json({slug, availableEpisodes: [], count: 0, exists: false, providers: []}, 200);
}

export function cleanHtmlText(text) {
  if (!text) return '';
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseKudasaiRss(xmlText) {
  const items = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const itemBlock = match[1];
    const titleMatch = itemBlock.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = itemBlock.match(/<link>([\s\S]*?)<\/link>/i) || itemBlock.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    const pubDateMatch = itemBlock.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const categoryMatch = itemBlock.match(/<category[^>]*>([\s\S]*?)<\/category>/i);
    const authorMatch = itemBlock.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) || itemBlock.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
    const descMatch = itemBlock.match(/<description>([\s\S]*?)<\/description>/i) || itemBlock.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i);
    
    let image = '';
    const mediaMatch = itemBlock.match(/<media:content[^>]+url=["']([^"']+)["']/i);
    if (mediaMatch) {
      image = mediaMatch[1];
    } else {
      const enclosureMatch = itemBlock.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
      if (enclosureMatch) {
        image = enclosureMatch[1];
      } else {
        const imgMatch = itemBlock.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) image = imgMatch[1];
      }
    }

    const titulo = cleanHtmlText(titleMatch ? titleMatch[1] : '');
    const url = (linkMatch ? linkMatch[1] : '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    const descripcion = cleanHtmlText(descMatch ? descMatch[1] : '').slice(0, 240);
    const fecha = (pubDateMatch ? pubDateMatch[1] : '').trim() || new Date().toISOString();
    const categoria = cleanHtmlText(categoryMatch ? categoryMatch[1] : '') || 'Anime';
    const autor = cleanHtmlText(authorMatch ? authorMatch[1] : '') || 'Somos Kudasai';

    if (titulo && url) {
      items.push({
        titulo,
        descripcion,
        imagen: image || 'assets/images/palmeritachan.png',
        fecha,
        url,
        categoria,
        autor
      });
    }
  }
  return items;
}

export function parseKudasaiHtml(htmlText) {
  const items = [];
  const articleMatches = htmlText.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi);
  for (const match of articleMatches) {
    const articleBlock = match[1];
    const linkMatch = articleBlock.match(/<a\b[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    const url = linkMatch ? linkMatch[1].trim() : '';
    
    // Extract title (prefer heading inside link or article)
    const titleHeaderMatch = articleBlock.match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i);
    const rawTitle = titleHeaderMatch ? titleHeaderMatch[1] : (linkMatch ? linkMatch[2] : '');
    const titulo = cleanHtmlText(rawTitle);

    // Extract image
    let image = '';
    const imgMatch = articleBlock.match(/<img\b[^>]+(?:data-src|srcset|src)=["']([^"'\s]+)["']/i);
    if (imgMatch) image = imgMatch[1];

    // Extract excerpt / description
    const pMatch = articleBlock.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const descripcion = cleanHtmlText(pMatch ? pMatch[1] : '').slice(0, 240);

    if (titulo && url && !titulo.toLowerCase().includes('cookie')) {
      items.push({
        titulo,
        descripcion: descripcion || 'Última noticia de anime desde Somos Kudasai',
        imagen: image || 'assets/images/palmeritachan.png',
        fecha: new Date().toISOString(),
        url: url.startsWith('http') ? url : `https://somoskudasai.com${url}`,
        categoria: 'Anime',
        autor: 'Somos Kudasai'
      });
    }
    if (items.length >= 25) break;
  }
  return items;
}

// In-memory cache for news (15-30 min)
let cachedNewsData = null;
let lastNewsFetchTime = 0;
const NEWS_CACHE_TTL = 20 * 60 * 1000; // 20 minutes

export function clearNewsCache() {
  cachedNewsData = null;
  lastNewsFetchTime = 0;
}

export async function resolveNoticias(request, fetcher = fetch, now = Date.now) {
  const currentTime = now();
  if (cachedNewsData && (currentTime - lastNewsFetchTime) < NEWS_CACHE_TTL) {
    return json({
      status: 'ok',
      cached: true,
      lastUpdated: new Date(lastNewsFetchTime).toISOString(),
      source: cachedNewsData.source,
      noticias: cachedNewsData.noticias
    });
  }

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const headers = { 'User-Agent': userAgent, 'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*' };

  // 1. Intentar feeds RSS oficiales
  const rssFeeds = [
    'https://somoskudasai.com/noticias/anime/feed/',
    'https://somoskudasai.com/noticias/feed/',
    'https://somoskudasai.com/feed/'
  ];

  for (const feedUrl of rssFeeds) {
    try {
      const response = await fetcher(feedUrl, {
        signal: AbortSignal.timeout(10000),
        headers
      });
      if (response.ok) {
        const text = await response.text();
        if (text && text.includes('<item>')) {
          const parsed = parseKudasaiRss(text);
          if (parsed.length > 0) {
            cachedNewsData = { source: 'rss', noticias: parsed };
            lastNewsFetchTime = currentTime;
            return json({
              status: 'ok',
              cached: false,
              lastUpdated: new Date(lastNewsFetchTime).toISOString(),
              source: 'rss',
              noticias: parsed
            });
          }
        }
      }
    } catch {
      // Continue to next feed or scraping
    }
  }

  // 2. Fallback scraping HTML si el RSS falla
  const htmlUrls = [
    'https://somoskudasai.com/noticias/anime/',
    'https://somoskudasai.com/'
  ];

  for (const htmlUrl of htmlUrls) {
    try {
      const response = await fetcher(htmlUrl, {
        signal: AbortSignal.timeout(10000),
        headers
      });
      if (response.ok) {
        const text = await response.text();
        if (text && text.includes('<article')) {
          const parsed = parseKudasaiHtml(text);
          if (parsed.length > 0) {
            cachedNewsData = { source: 'scraping', noticias: parsed };
            lastNewsFetchTime = currentTime;
            return json({
              status: 'ok',
              cached: false,
              lastUpdated: new Date(lastNewsFetchTime).toISOString(),
              source: 'scraping',
              noticias: parsed
            });
          }
        }
      }
    } catch {
      // Continue
    }
  }

  // Si fallan todas las fuentes y tenemos datos anteriores, devolverlos como stale
  if (cachedNewsData) {
    return json({
      status: 'stale',
      cached: true,
      lastUpdated: new Date(lastNewsFetchTime).toISOString(),
      source: cachedNewsData.source,
      noticias: cachedNewsData.noticias
    });
  }

  return json({
    status: 'unavailable',
    error: 'Servicio de noticias de Somos Kudasai temporalmente no disponible.',
    lastUpdated: new Date(currentTime).toISOString(),
    noticias: []
  }, 503);
}

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: {
    'Cache-Control': 'public, max-age=300',
    'Access-Control-Allow-Origin': '*'
  }
});

// In-memory cache for players (2 hours TTL)
const playerCache = new Map();
const PLAYER_CACHE_TTL = 2 * 60 * 60 * 1000;

export function clearPlayerCache() {
  playerCache.clear();
}

export async function fetchAnimeAv1Players(slug, episode, fetcher = fetch) {
  const sourceUrl = `https://animeav1.com/media/${slug}/${episode}`;
  try {
    const response = await fetcher(sourceUrl, {redirect:'manual', signal:AbortSignal.timeout(12000), headers:{Accept:'text/html'}});
    if (!response.ok) {
      return { sourceUrl, players: [], errorStatus: response.status };
    }
    if (!(response.headers.get('content-type') || '').includes('text/html')) {
      return { sourceUrl, players: [], errorStatus: 502 };
    }
    const reader = response.body.getReader(); const chunks=[]; let size=0;
    while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>2000000){await reader.cancel(); return { sourceUrl, players: [] };} chunks.push(value); }
    const bytes=new Uint8Array(size); let offset=0; for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    const players = extractPlayers(new TextDecoder().decode(bytes));
    return { sourceUrl, players };
  } catch {
    return { sourceUrl, players: [] };
  }
}

export async function fetchJkPlayers(slug, episode, fetcher = fetch) {
  const jkUrl = `https://jkanime.net/${slug}/${episode}/`;
  try {
    const jkRes = await fetcher(jkUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (jkRes.ok) {
      const jkHtml = await jkRes.text();
      const jkPlayers = extractJkPlayers(jkHtml);
      return { sourceUrl: jkRes.url || jkUrl, players: jkPlayers };
    }
  } catch { /* Continue */ }
  return { sourceUrl: jkUrl, players: [] };
}

export async function resolvePlayer(request, fetcher = fetch, now = Date.now) {
  const q = new URL(request.url).searchParams;
  const slug = q.get('slug') || '', episode = q.get('episode') || '';
  const providerParam = (q.get('provider') || 'all').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180 || !/^[1-9]\d{0,4}$/.test(episode)) return json({error:'Capítulo no válido.'},400);

  const cacheKey = `${slug}:${episode}:${providerParam}`;
  const currentTime = now();
  const cached = playerCache.get(cacheKey);
  if (cached && (currentTime - cached.time) < PLAYER_CACHE_TTL) {
    return json({ sourceUrl: cached.sourceUrl, players: cached.players, providers: cached.providers, cached: true });
  }

  let players = [];
  let sourceUrl = `https://animeav1.com/media/${slug}/${episode}`;
  const availableProviders = [];

  if (providerParam === 'animeav1') {
    const av1 = await fetchAnimeAv1Players(slug, episode, fetcher);
    if (av1.errorStatus && av1.errorStatus !== 404) {
      return json({error:'La página de origen no está disponible.',sourceUrl},502);
    }
    players = av1.players;
    sourceUrl = av1.sourceUrl;
    if (players.length) availableProviders.push('animeav1');
  } else if (providerParam === 'jkanime') {
    const jk = await fetchJkPlayers(slug, episode, fetcher);
    players = jk.players;
    sourceUrl = jk.sourceUrl;
    if (players.length) availableProviders.push('jkanime');
  } else {
    // 'all': consultar ambos en paralelo
    const [av1Res, jkRes] = await Promise.allSettled([
      fetchAnimeAv1Players(slug, episode, fetcher),
      fetchJkPlayers(slug, episode, fetcher)
    ]);

    const av1 = av1Res.status === 'fulfilled' ? av1Res.value : { players: [], sourceUrl };
    const jk = jkRes.status === 'fulfilled' ? jkRes.value : { players: [], sourceUrl: '' };

    if (av1.errorStatus && av1.errorStatus !== 404 && !jk.players?.length) {
      return json({error:'La página de origen no está disponible.',sourceUrl},502);
    }

    if (av1.players?.length) availableProviders.push('animeav1');
    if (jk.players?.length) availableProviders.push('jkanime');

    players = [...(av1.players || []), ...(jk.players || [])];
    sourceUrl = av1.players?.length ? av1.sourceUrl : (jk.sourceUrl || sourceUrl);
  }

  if (players.length) {
    playerCache.set(cacheKey, { sourceUrl, players, providers: availableProviders, time: currentTime });
    return json({ sourceUrl, players, providers: availableProviders });
  }

  return json({ error: 'Este capítulo aún no está disponible para su reproducción.', sourceUrl, notReleased: true }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/player') {
      if (request.method !== 'GET') return json({error:'Método no permitido.'},405);
      return resolvePlayer(request);
    }
    if (url.pathname === '/api/media') {
      if (request.method !== 'GET') return json({error:'Método no permitido.'},405);
      return resolveMedia(request);
    }
    if (url.pathname === '/api/noticias') {
      if (request.method !== 'GET') return json({error:'Método no permitido.'},405);
      return resolveNoticias(request);
    }
    const response = await env.ASSETS.fetch(request);
    if (response.status === 404 && request.method === 'GET' && request.headers.get('accept')?.includes('text/html')) {
      return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
    }
    return response;
  }
};
