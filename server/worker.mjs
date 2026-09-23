const hosts = new Set(['player.zilla-networks.com', 'animeav1.uns.bio', 'voe.sx', 'mega.nz', 'www.mp4upload.com', 'mp4upload.com', 'byselapuix.com', 'jkanime.net']);
let malTopCache = null;

export function extractMalTop(html) {
  const entries = [];
  for (const match of html.matchAll(/<tr class="ranking-list"[\s\S]*?<\/tr>/g)) {
    const row = match[0];
    const id = Number(row.match(/myanimelist\.net\/anime\/(\d+)\//)?.[1]);
    const title = row.match(/anime_ranking_h3[^>]*><a[^>]*>([^<]+)<\/a>/)?.[1];
    const image = row.match(/data-src="(https:\/\/cdn\.myanimelist\.net\/[^" ]+)"/)?.[1];
    if (!id || !title || !image) continue;
    const imageUrl = image.replace(/\/r\/50x70\//, '/').replace(/\?s=.*$/, '');
    const episodes = Number(row.match(/\((\d+) eps?\)/)?.[1]) || null;
    const score = row.match(/score-label score-[^" ]+">([\d.]+)</)?.[1] || null;
    entries.push({ mal_id: id, title, images: { jpg: { image_url: imageUrl, large_image_url: imageUrl } }, episodes, score, rank: entries.length + 1 });
    if (entries.length === 3) break;
  }
  return entries;
}

async function resolveMalTop() {
  if (malTopCache && Date.now() - malTopCache.time < 60 * 60 * 1000) return json({ data: malTopCache.data, source: 'myanimelist' });
  try {
    const response = await fetch('https://myanimelist.net/topanime.php', {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; Palmerita/1.0)' }
    });
    if (!response.ok) throw new Error(`MyAnimeList ${response.status}`);
    const data = extractMalTop(await response.text());
    if (data.length !== 3) throw new Error('Ranking incompleto');
    malTopCache = { data, time: Date.now() };
    return json({ data, source: 'myanimelist' });
  } catch {
    if (malTopCache) return json({ data: malTopCache.data, source: 'myanimelist' });
    return json({ error: 'El ranking de MyAnimeList no está disponible temporalmente.' }, 503);
  }
}

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
        const linkedEpisodes = new Set();
        for (const link of jkText.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
          try {
            const episodeUrl = new URL(link[1], jkUrl);
            if (episodeUrl.hostname !== 'jkanime.net') continue;
            const episodeMatch = episodeUrl.pathname.match(new RegExp(`^/${slug}/([1-9]\\d{0,3})/?$`));
            if (episodeMatch) linkedEpisodes.add(parseInt(episodeMatch[1], 10));
          } catch { /* Ignore malformed links. */ }
        }
        // Algunas fichas muestran "Episodios: 0" durante la emisión aunque
        // sí enlacen al último capítulo publicado.
        if (linkedEpisodes.size) count = Math.max(...linkedEpisodes);
        if (isMovie && count === 0) count = 1;
        if (count > 0 && count < 10000) {
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

function normalizedTitle(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/(?:dai[\s-]*){2,}daisuki/g, match => match.replace(/[\s-]/g, ''))
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function titleSeason(value) {
  const title = normalizedTitle(value);
  const numbered = title.match(/(?:season|temporada) (\d+)|(\d+)(?:st|nd|rd|th) season/);
  if (numbered) return Number(numbered[1] || numbered[2]);
  if (/\biii\b/.test(title)) return 3;
  if (/\bii\b/.test(title)) return 2;
  return 1;
}

export function matchCatalogTitle(candidate, titles) {
  const candidateSeason = titleSeason(candidate);
  const candidateWords = new Set(normalizedTitle(candidate).split(' ').filter(word => word.length > 2));
  for (const title of titles) {
    if (titleSeason(title) !== candidateSeason) continue;
    const words = new Set(normalizedTitle(title).split(' ').filter(word => word.length > 2));
    const overlap = [...words].filter(word => candidateWords.has(word)).length;
    if (words.size >= 2 && overlap / Math.max(words.size, candidateWords.size) >= 0.72) return true;
  }
  return false;
}

async function savedStreamingSources(db, malId) {
  if (!db) return {};
  try {
    const row = await db.prepare('SELECT animeav1_slug, jkanime_slug FROM streaming_matches WHERE mal_id = ?').bind(malId).first();
    return { animeav1: row?.animeav1_slug || null, jkanime: row?.jkanime_slug || null };
  } catch { return {}; }
}

async function saveStreamingSources(db, malId, sources) {
  if (!db) return;
  try {
    await db.prepare('INSERT INTO streaming_matches (mal_id, animeav1_slug, jkanime_slug, verified_at) VALUES (?, ?, ?, ?) ON CONFLICT(mal_id) DO UPDATE SET animeav1_slug = excluded.animeav1_slug, jkanime_slug = excluded.jkanime_slug, verified_at = excluded.verified_at')
      .bind(malId, sources.animeav1 || null, sources.jkanime || null, Date.now()).run();
  } catch { /* Availability still works when storage is temporarily unavailable. */ }
}

export async function resolveAnimeMedia(request, db, fetcher = fetch) {
  const q = new URL(request.url).searchParams;
  const malId = Number(q.get('malId'));
  let titles;
  try { titles = JSON.parse(q.get('titles') || '[]'); } catch { titles = null; }
  if (!Number.isSafeInteger(malId) || malId < 1 || malId > 10000000 || !Array.isArray(titles) || titles.length > 8 ||
      titles.some(title => typeof title !== 'string' || title.length > 160)) {
    return json({error: 'Anime no válido.'}, 400);
  }
  titles = titles.filter(Boolean);
  const slugs = [];
  const addSlug = slug => {
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 180 && !slugs.includes(slug)) slugs.push(slug);
  };
  const saved = await savedStreamingSources(db, malId);
  if (saved.animeav1) addSlug(saved.animeav1);
  if (saved.jkanime) addSlug(saved.jkanime);
  for (const title of titles) {
    const slug = normalizedTitle(title).replace(/ /g, '-');
    addSlug(slug);
    addSlug(slug.replace(/(?:dai-){2,}daisuki/g, match => match.replaceAll('-', '')));
  }

  const sources = {};
  const episodes = new Set();
  const checked = new Set();
  const checkSlug = async slug => {
    if (checked.has(slug)) return;
    checked.add(slug);
    const [av1, jk] = await Promise.all([
      sources.animeav1 ? null : fetchAnimeAv1Media(slug, fetcher),
      sources.jkanime ? null : fetchJkMedia(slug, fetcher)
    ]);
    if (av1?.exists) {
      sources.animeav1 = slug;
      for (const episode of av1.availableEpisodes) episodes.add(episode);
    }
    if (jk?.exists) {
      sources.jkanime = slug;
      for (const episode of jk.availableEpisodes) episodes.add(episode);
    }
  };
  for (const slug of slugs) {
    await checkSlug(slug);
    if (sources.animeav1 && sources.jkanime) break;
  }

  // Buscar en el catálogo solo después de agotar las variantes directas.
  for (const title of sources.animeav1 ? [] : titles.slice(0, 3)) {
    try {
      const search = await fetcher(`https://animeav1.com/catalogo?search=${encodeURIComponent(title)}`, {
        signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' }
      });
      if (!search.ok) continue;
      const html = await search.text();
      for (const match of html.matchAll(/<h3[^>]*>([^<]+)<\/h3>[\s\S]{0,300}?href="\/media\/([a-z0-9-]+)"/gi)) {
        const [, catalogTitle, slug] = match;
        if (!matchCatalogTitle(catalogTitle, titles)) continue;
        slugs.push(slug);
        await checkSlug(slug);
        if (sources.animeav1) break;
      }
    } catch { /* Try the next title. */ }
  }
  for (const title of sources.jkanime ? [] : titles.slice(0, 3)) {
    try {
      const query = normalizedTitle(title).split(' ').slice(0, 4).join(' ');
      const search = await fetcher(`https://jkanime.net/buscar?q=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(12000), headers: { Accept: 'text/html' }
      });
      if (!search.ok) continue;
      const html = await search.text();
      for (const match of html.matchAll(/<h5>\s*<a[^>]*href="https:\/\/jkanime\.net\/([a-z0-9-]+)\/"[^>]*>([^<]+)<\/a>/gi)) {
        const [, slug, catalogTitle] = match;
        if (!matchCatalogTitle(catalogTitle, titles)) continue;
        slugs.push(slug);
        await checkSlug(slug);
        if (sources.jkanime) break;
      }
    } catch { /* Try the next title. */ }
  }
  if (sources.animeav1 || sources.jkanime) {
    await saveStreamingSources(db, malId, sources);
    const providers = Object.keys(sources);
    const availableEpisodes = [...episodes].sort((a, b) => a - b);
    const slug = sources.animeav1 || sources.jkanime;
    return json({slug, sources, availableEpisodes, count: availableEpisodes.length, exists: true,
      provider: providers.length > 1 ? 'both' : providers[0], providers});
  }
  return json({availableEpisodes: [], count: 0, exists: false, providers: [], sources: {}});
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
  const jkSlug = q.get('jkSlug') || slug;
  const providerParam = (q.get('provider') || 'all').toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(jkSlug) || jkSlug.length > 180 ||
      !/^[1-9]\d{0,4}$/.test(episode)) return json({error:'Capítulo no válido.'},400);

  const cacheKey = `${slug}:${jkSlug}:${episode}:${providerParam}`;
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
    const jk = await fetchJkPlayers(jkSlug, episode, fetcher);
    players = jk.players;
    sourceUrl = jk.sourceUrl;
    if (players.length) availableProviders.push('jkanime');
  } else {
    // 'all': consultar ambos en paralelo
    const [av1Res, jkRes] = await Promise.allSettled([
      fetchAnimeAv1Players(slug, episode, fetcher),
      fetchJkPlayers(jkSlug, episode, fetcher)
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
    if (url.pathname === '/api/mal-top') {
      if (request.method !== 'GET') return json({error:'Método no permitido.'},405);
      return resolveMalTop();
    }
    if (url.pathname === '/api/player') {
      if (request.method !== 'GET') return json({error:'Método no permitido.'},405);
      return resolvePlayer(request);
    }
    if (url.pathname === '/api/media') {
      if (request.method !== 'GET') return json({error:'Método no permitido.'},405);
      return resolveMedia(request);
    }
    if (url.pathname === '/api/anime-media') {
      if (request.method !== 'GET') return json({error:'Método no permitido.'},405);
      return resolveAnimeMedia(request, env.DB);
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
