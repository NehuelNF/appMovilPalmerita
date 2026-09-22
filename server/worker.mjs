const hosts = new Set(['player.zilla-networks.com', 'animeav1.uns.bio', 'voe.sx', 'mega.nz', 'www.mp4upload.com', 'mp4upload.com']);
export function validEmbed(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.port && hosts.has(u.hostname); } catch { return false; }
}
export function extractPlayers(html) {
  const players = [];
  const add = (url, name) => {
    url = url.replaceAll('&amp;', '&');
    if (validEmbed(url) && !players.some(p => p.url === url)) players.push({url, name});
  };
  for (const m of html.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) add(m[1], 'Principal');
  for (const m of html.matchAll(/\{server:"([^"<>]{1,40})",url:"(https:\/\/[^"<>]+)"\}/g)) {
    if (/\/e\/|\/embed[/-]|\/play\/|uns\.bio\/#/.test(m[2])) add(m[2], m[1]);
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
const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control':'no-store'}});
export function extractMediaEpisodes(html, slug) {
  const pattern = new RegExp(`(?:/media/${slug}/|/ver/${slug}-|/ver/${slug}/)(\\d+)`, 'gi');
  const episodes = new Set();
  for (const m of html.matchAll(pattern)) {
    const epNum = parseInt(m[1], 10);
    if (epNum > 0 && epNum < 10000) episodes.add(epNum);
  }
  return Array.from(episodes).sort((a, b) => a - b);
}
export async function resolveMedia(request, fetcher = fetch) {
  const q = new URL(request.url).searchParams;
  const slug = q.get('slug') || '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180) return json({error:'Slug no válido.'},400);
  const sourceUrl = `https://animeav1.com/media/${slug}`;
  try {
    const response = await fetcher(sourceUrl, {redirect:'manual', signal:AbortSignal.timeout(12000), headers:{Accept:'text/html'}});
    if (response.status === 404) return json({slug, availableEpisodes: [], count: 0, exists: false}, 200);
    if (!response.ok) return json({error:'La página de origen no está disponible.',sourceUrl},502);
    if (!(response.headers.get('content-type') || '').includes('text/html')) return json({error:'Respuesta del proveedor no válida.',sourceUrl},502);
    const text = await response.text();
    const availableEpisodes = extractMediaEpisodes(text, slug);
    return json({slug, availableEpisodes, count: availableEpisodes.length, exists: true, sourceUrl});
  } catch { return json({error:'No se pudo consultar la disponibilidad de episodios.',sourceUrl},502); }
}
export async function resolvePlayer(request, fetcher = fetch) {
  const q = new URL(request.url).searchParams;
  const slug = q.get('slug') || '', episode = q.get('episode') || '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 180 || !/^[1-9]\d{0,4}$/.test(episode)) return json({error:'Capítulo no válido.'},400);
  const sourceUrl = `https://animeav1.com/media/${slug}/${episode}`;
  try {
    // No arbitrary URLs or redirects: this endpoint cannot proxy internal resources.
    const response = await fetcher(sourceUrl, {redirect:'manual', signal:AbortSignal.timeout(12000), headers:{Accept:'text/html'}});
    if (!response.ok) {
      if (response.status === 404) {
        return json({error:'Este capítulo aún no está disponible para su reproducción.',sourceUrl,notReleased:true},404);
      }
      return json({error:'La página de origen no está disponible.',sourceUrl},502);
    }
    if (!(response.headers.get('content-type') || '').includes('text/html')) return json({error:'Respuesta del proveedor no válida.',sourceUrl},502);
    const reader = response.body.getReader(); const chunks=[]; let size=0;
    while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>2000000){await reader.cancel(); return json({error:'Respuesta demasiado grande.'},502);} chunks.push(value); }
    const bytes=new Uint8Array(size); let offset=0; for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    const players=extractPlayers(new TextDecoder().decode(bytes));
    const mp4Embed=players.find(player => /mp4upload/i.test(player.name) || /mp4upload/i.test(player.url));
    if(mp4Embed) {
      try {
        const mp4Response=await fetcher(mp4Embed.url,{redirect:'follow',signal:AbortSignal.timeout(10000),headers:{Accept:'text/html',Referer:sourceUrl}});
        if(mp4Response.ok && (mp4Response.headers.get('content-type') || '').includes('text/html')) {
          const directUrl=extractDirectVideo(await mp4Response.text());
          if(directUrl) players.unshift({url:directUrl,name:'Reproductor seguro',type:'direct'});
        }
      } catch { /* Keep iframe mirrors when direct extraction is unavailable. */ }
    }
    return players.length ? json({sourceUrl,players}) : json({error:'No hay un reproductor compatible disponible para este capítulo.',sourceUrl},404);
  } catch { return json({error:'No se pudo consultar el reproductor. Inténtalo de nuevo.',sourceUrl},502); }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if(url.pathname === '/api/player') {
      if(request.method !== 'GET') return json({error:'Método no permitido.'},405);
      return resolvePlayer(request);
    }
    if(url.pathname === '/api/media') {
      if(request.method !== 'GET') return json({error:'Método no permitido.'},405);
      return resolveMedia(request);
    }
    const response=await env.ASSETS.fetch(request);
    if(response.status===404 && request.method==='GET' && request.headers.get('accept')?.includes('text/html')) return env.ASSETS.fetch(new Request(new URL('/index.html',url),request));
    return response;
  }
};
