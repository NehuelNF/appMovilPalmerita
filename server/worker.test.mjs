import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPlayers,
  extractDirectVideo,
  validEmbed,
  resolvePlayer,
  clearPlayerCache,
  cleanHtmlText,
  parseKudasaiRss,
  parseKudasaiHtml,
  resolveNoticias,
  clearNewsCache,
  extractMediaEpisodes,
  resolveMedia,
  extractJkPlayers
} from './worker.mjs';
test('only real supported embeds are returned and deduplicated',()=>{
  const html='<iframe src="https://voe.sx/e/abc"></iframe><iframe src="https://ads.example/video"></iframe>{server:"Voe",url:"https://voe.sx/e/abc"}{server:"Mega",url:"https://mega.nz/file/abc"}';
  assert.deepEqual(extractPlayers(html),[{url:'https://voe.sx/e/abc',name:'Principal',audio:'sub',provider:'animeav1'}]);
  assert.equal(validEmbed('https://voe.sx.evil.example/e/x'),false);
  assert.equal(validEmbed('http://voe.sx/e/x'),false);
  assert.equal(validEmbed('https://user:pass@voe.sx/e/x'),false);
});

test('extractPlayers parses SUB and DUB separately with server names and audio tags', () => {
  const html = `embeds:{SUB:[{server:"HLS",url:"https://player.zilla-networks.com/play/123"},{server:"UPNShare",url:"https://animeav1.uns.bio/#abc"}],DUB:[{server:"HLS",url:"https://player.zilla-networks.com/play/456"},{server:"Byse",url:"https://byselapuix.com/e/xyz"}]}`;
  const players = extractPlayers(html);
  assert.equal(players.length, 4);
  assert.equal(players[0].audio, 'sub');
  assert.equal(players[0].name, 'HLS');
  assert.equal(players[1].audio, 'sub');
  assert.equal(players[1].name, 'UPNShare');
  assert.equal(players[2].audio, 'dub');
  assert.equal(players[2].name, 'HLS');
  assert.equal(players[3].audio, 'dub');
  assert.equal(players[3].name, 'Byse');
});

test('invalid request never fetches a URL',async()=>{
  const r=await resolvePlayer(new Request('https://local/api/player?slug=../../private&episode=1'),()=>{throw Error('must not fetch');});
  assert.equal(r.status,400);
});

test('direct MP4 URL is accepted only from MP4Upload hosts',()=>{
  assert.equal(extractDirectVideo('src: "https://a4.mp4upload.com:183/d/token/video.mp4"'),'https://a4.mp4upload.com:183/d/token/video.mp4');
  assert.equal(extractDirectVideo('src: "https://evil.example/video.mp4"'),null);
});

test('redirects and missing embeds produce errors',async()=>{
  clearPlayerCache();
  const req=new Request('https://local/api/player?slug=one-piece&episode=1');
  assert.equal((await resolvePlayer(req,async()=>new Response('',{status:302}))).status,502);
  assert.equal((await resolvePlayer(req,async()=>new Response('<html></html>',{headers:{'Content-Type':'text/html'}}))).status,404);
});
test('source returning 404 produces notReleased error',async()=>{
 const req=new Request('https://local/api/player?slug=yani-neko&episode=12');
 const res=await resolvePlayer(req,async()=>new Response('Not Found',{status:404}));
 assert.equal(res.status,404);
 const data=await res.json();
 assert.equal(data.notReleased,true);
 assert.match(data.error,/aún no está disponible/i);
});
test('extractMediaEpisodes extracts and sorts episode numbers',()=>{
 const html='<a href="/media/yani-neko/1">1</a><a href="/media/yani-neko/2">2</a><a href="/media/yani-neko/11">11</a>';
 assert.deepEqual(extractMediaEpisodes(html,'yani-neko'),[1,2,11]);
});
test('resolveMedia returns available episodes from provider',async()=>{
 const req=new Request('https://local/api/media?slug=yani-neko');
 const res=await resolveMedia(req,async(url,options)=>{
   assert.equal(url,'https://animeav1.com/media/yani-neko');
   return new Response('<a href="/media/yani-neko/1">1</a><a href="/media/yani-neko/2">2</a>',{headers:{'Content-Type':'text/html'}});
 });
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.exists,true);
 assert.deepEqual(data.availableEpisodes,[1,2]);
 assert.equal(data.count,2);
});
test('resolveMedia returns empty list on 404',async()=>{
 const req=new Request('https://local/api/media?slug=unknown-anime');
 const res=await resolveMedia(req,async()=>new Response('Not found',{status:404}));
 assert.equal(res.status,200);
 const data=await res.json();
 assert.equal(data.exists,false);
 assert.deepEqual(data.availableEpisodes,[]);
});
test('resolver returns extracted embed and exact episode source',async()=>{
  clearPlayerCache();
  const r=await resolvePlayer(new Request('https://local/api/player?slug=one-piece&episode=2'),async(url,options)=>{
    assert.equal(url,'https://animeav1.com/media/one-piece/2'); assert.equal(options.redirect,'manual');
    return new Response('<iframe src="https://voe.sx/e/episode2"></iframe>',{headers:{'Content-Type':'text/html'}});
  });
  assert.equal(r.status,200); assert.equal((await r.json()).players[0].url,'https://voe.sx/e/episode2');
});

test('playerCache serves cached response without refetching', async () => {
  clearPlayerCache();
  let fetchCount = 0;
  const mockFetcher = async () => {
    fetchCount++;
    return new Response('<iframe src="https://voe.sx/e/cache-test"></iframe>', { headers: { 'Content-Type': 'text/html' } });
  };
  const req = new Request('https://local/api/player?slug=bleach&episode=1');
  let currentTime = 1000;
  const res1 = await resolvePlayer(req, mockFetcher, () => currentTime);
  assert.equal(res1.status, 200);
  assert.equal(fetchCount, 2);

  // Second call within 2 hours
  currentTime += 30 * 60 * 1000;
  const res2 = await resolvePlayer(req, mockFetcher, () => currentTime);
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.cached, true);
  assert.equal(fetchCount, 2);
});

test('cleanHtmlText cleans tags, entities, and CDATA correctly',()=>{
  const raw = '<![CDATA[  <h1>Noticia de &amp; Anime&#8211;2026</h1> <p>Resumen &quot;genial&quot;&nbsp;... </p> ]]>';
  assert.equal(cleanHtmlText(raw), 'Noticia de & Anime-2026 Resumen "genial" ...');
});

test('parseKudasaiRss extracts items with title, url, image, description, date and category',()=>{
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
    <channel>
      <item>
        <title><![CDATA[Nuevo anime de acción anunciado]]></title>
        <link>https://somoskudasai.com/noticias/nuevo-anime/</link>
        <pubDate>Tue, 22 Sep 2026 02:00:00 +0000</pubDate>
        <dc:creator><![CDATA[Redactor]]></dc:creator>
        <category><![CDATA[Anime]]></category>
        <media:content url="https://cdn.somoskudasai.com/imagen.jpg" medium="image" />
        <description><![CDATA[Descripción emocionante del anime...]]></description>
      </item>
    </channel>
  </rss>`;
  const items = parseKudasaiRss(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0].titulo, 'Nuevo anime de acción anunciado');
  assert.equal(items[0].url, 'https://somoskudasai.com/noticias/nuevo-anime/');
  assert.equal(items[0].imagen, 'https://cdn.somoskudasai.com/imagen.jpg');
  assert.equal(items[0].categoria, 'Anime');
  assert.equal(items[0].autor, 'Redactor');
  assert.equal(items[0].descripcion, 'Descripción emocionante del anime...');
});

test('parseKudasaiHtml extracts articles when RSS is unavailable',()=>{
  const html = `<html><body>
    <article>
      <h2><a href="/noticias/anime-fallback/">Título de Noticia Fallback</a></h2>
      <img src="https://cdn.somoskudasai.com/fallback.jpg" />
      <p>Texto del artículo obtenido vía scraping.</p>
    </article>
  </body></html>`;
  const items = parseKudasaiHtml(html);
  assert.equal(items.length, 1);
  assert.equal(items[0].titulo, 'Título de Noticia Fallback');
  assert.equal(items[0].url, 'https://somoskudasai.com/noticias/anime-fallback/');
  assert.equal(items[0].imagen, 'https://cdn.somoskudasai.com/fallback.jpg');
});

test('resolveNoticias uses RSS feed and caches result', async () => {
  clearNewsCache();
  let fetchCount = 0;
  const mockFetcher = async (url) => {
    fetchCount++;
    const xml = `<rss version="2.0"><channel><item><title>Noticia 1</title><link>https://somoskudasai.com/1</link><pubDate>Wed, 23 Sep 2026</pubDate><description>Desc</description></item></channel></rss>`;
    return new Response(xml, { status: 200 });
  };

  const req = new Request('https://local/api/noticias');
  let simulatedTime = 1000000;
  const res1 = await resolveNoticias(req, mockFetcher, () => simulatedTime);
  assert.equal(res1.status, 200);
  const data1 = await res1.json();
  assert.equal(data1.status, 'ok');
  assert.equal(data1.source, 'rss');
  assert.equal(data1.noticias.length, 1);
  assert.equal(fetchCount, 1);

  // Subsequent call within 20 minutes should hit cache without fetching again
  simulatedTime += 5 * 60 * 1000; // 5 min later
  const res2 = await resolveNoticias(req, mockFetcher, () => simulatedTime);
  assert.equal(res2.status, 200);
  const data2 = await res2.json();
  assert.equal(data2.cached, true);
  assert.equal(fetchCount, 1);
});

test('resolveNoticias falls back to HTML scraping if RSS fails', async () => {
  clearNewsCache();
  const mockFetcher = async (url) => {
    if (url.includes('/feed/')) {
      return new Response('', { status: 500 });
    }
    const html = `<html><body><article><h2><a href="/noticias/scrape-success/">Noticia Scraped</a></h2><p>Resumen</p></article></body></html>`;
    return new Response(html, { status: 200 });
  };

  const req = new Request('https://local/api/noticias');
  const res = await resolveNoticias(req, mockFetcher, () => 2000000);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.source, 'scraping');
  assert.equal(data.noticias[0].titulo, 'Noticia Scraped');
});

test('resolveNoticias returns 503 unavailable if both RSS and HTML fail and no cache exists', async () => {
  clearNewsCache();
  const mockFetcher = async () => new Response('', { status: 500 });

  const req = new Request('https://local/api/noticias');
  const res = await resolveNoticias(req, mockFetcher, () => 3000000);
  assert.equal(res.status, 503);
  const data = await res.json();
  assert.equal(data.status, 'unavailable');
  assert.equal(data.noticias.length, 0);
});

test('extractJkPlayers parses video iframes and maps server labels', () => {
  const html = `
    <div class="bg-servers">
      <a data-id="0" class="servers">Desu</a>
      <a data-id="1" class="servers">Magi</a>
    </div>
    <script>
      var video = [];
      video[0] = '<iframe src="https://jkanime.net/jkplayer/um?e=token123"></iframe>';
      video[1] = '<iframe src="https://jkanime.net/jkplayer/umv?e=token456"></iframe>';
      video[2] = '<iframe src="https://untrusted.example/embed"></iframe>';
    </script>
  `;
  const players = extractJkPlayers(html);
  assert.equal(players.length, 2);
  assert.equal(players[0].name, 'Desu (JK)');
  assert.equal(players[0].url, 'https://jkanime.net/jkplayer/um?e=token123');
  assert.equal(players[0].provider, 'jkanime');
  assert.equal(players[1].name, 'Magi (JK)');
  assert.equal(players[1].url, 'https://jkanime.net/jkplayer/umv?e=token456');
});

test('resolveMedia falls back to JKAnime when AnimeAV1 returns 404', async () => {
  const mockFetcher = async (url) => {
    if (url.includes('animeav1.com')) {
      return new Response('Not found', { status: 404 });
    }
    if (url.includes('jkanime.net/gintama-aizome-kaori-hen/')) {
      const html = `<div><span>Tipo:</span> OVA <span>Episodios:</span> 2</div>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    return new Response('Not found', { status: 404 });
  };

  const req = new Request('https://local/api/media?slug=gintama-aizome-kaori-hen');
  const res = await resolveMedia(req, mockFetcher);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.exists, true);
  assert.equal(data.provider, 'jkanime');
  assert.deepEqual(data.availableEpisodes, [1, 2]);
  assert.equal(data.count, 2);
});

test('resolvePlayer falls back to JKAnime when AnimeAV1 returns 404', async () => {
  clearPlayerCache();
  const mockFetcher = async (url) => {
    if (url.includes('animeav1.com')) {
      return new Response('Not found', { status: 404 });
    }
    if (url.includes('jkanime.net/gintama-aizome-kaori-hen/1/')) {
      const html = `
        <div class="bg-servers"><a data-id="0" class="servers">Desu</a></div>
        <script>
          var video = [];
          video[0] = '<iframe src="https://jkanime.net/jkplayer/um?e=abc1234"></iframe>';
        </script>
      `;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    return new Response('Not found', { status: 404 });
  };

  const req = new Request('https://local/api/player?slug=gintama-aizome-kaori-hen&episode=1');
  const res = await resolvePlayer(req, mockFetcher, () => 5000000);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.players.length, 1);
  assert.equal(data.players[0].name, 'Desu (JK)');
  assert.equal(data.players[0].provider, 'jkanime');
});

test('extractPlayers parses DUB before SUB correctly (Mushoku Tensei case)', () => {
  const html = `
    variants:{DUB:1,SUB:1},
    embeds:{
      DUB:[{server:"HLS",url:"https://player.zilla-networks.com/play/dub123"},{server:"Voe",url:"https://voe.sx/e/dub456"}],
      SUB:[{server:"HLS",url:"https://player.zilla-networks.com/play/sub123"},{server:"UPNShare",url:"https://animeav1.uns.bio/#sub456"}]
    },
    downloads:{DUB:[],SUB:[]}
  `;
  const players = extractPlayers(html);
  assert.equal(players.length, 4);
  const subPlayers = players.filter(p => p.audio === 'sub');
  const dubPlayers = players.filter(p => p.audio === 'dub');
  assert.equal(subPlayers.length, 2);
  assert.equal(dubPlayers.length, 2);
  assert.equal(subPlayers[0].name, 'HLS');
  assert.equal(subPlayers[1].name, 'UPNShare');
  assert.equal(dubPlayers[0].name, 'HLS');
  assert.equal(dubPlayers[1].name, 'Voe');
});

test('resolvePlayer supports provider parameter filtering', async () => {
  clearPlayerCache();
  const mockFetcher = async (url) => {
    if (url.includes('animeav1.com')) {
      return new Response('embeds:{SUB:[{server:"HLS",url:"https://player.zilla-networks.com/play/av1"}]}', { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    if (url.includes('jkanime.net')) {
      const html = `<script>var video = []; video[0] = '<iframe src="https://jkanime.net/jkplayer/um?e=jk123"></iframe>';</script>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    return new Response('Not found', { status: 404 });
  };

  // Test provider=animeav1
  const resAv1 = await resolvePlayer(new Request('https://local/api/player?slug=test&episode=1&provider=animeav1'), mockFetcher);
  assert.equal(resAv1.status, 200);
  const dataAv1 = await resAv1.json();
  assert.equal(dataAv1.players.length, 1);
  assert.equal(dataAv1.players[0].provider, 'animeav1');

  // Test provider=jkanime
  const resJk = await resolvePlayer(new Request('https://local/api/player?slug=test&episode=1&provider=jkanime'), mockFetcher);
  assert.equal(resJk.status, 200);
  const dataJk = await resJk.json();
  assert.equal(dataJk.players.length, 1);
  assert.equal(dataJk.players[0].provider, 'jkanime');

  // Test provider=all (both combined)
  const resAll = await resolvePlayer(new Request('https://local/api/player?slug=test&episode=1&provider=all'), mockFetcher);
  assert.equal(resAll.status, 200);
  const dataAll = await resAll.json();
  assert.equal(dataAll.players.length, 2);
  assert.deepEqual(dataAll.providers, ['animeav1', 'jkanime']);
});



