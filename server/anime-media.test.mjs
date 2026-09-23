import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCatalogTitle, resolveAnimeMedia, resolvePlayer, filterUnavailablePlayers } from './worker.mjs';

test('broken VOE and reported UPNShare links are removed without hiding other servers', async () => {
  const players = [
    { url: 'https://voe.sx/e/broken', name: 'Voe', provider: 'animeav1' },
    { url: 'https://animeav1.uns.bio/#hdb33u', name: 'UPNShare', provider: 'animeav1' },
    { url: 'https://byselapuix.com/e/working', name: 'Byse', provider: 'animeav1' }
  ];
  const result = await filterUnavailablePlayers(players, async () => new Response('', { status: 404 }));
  assert.deepEqual(result.map(player => player.name), ['Byse']);
});

test('catalog matching rejects another season', () => {
  assert.equal(matchCatalogTitle('Example Anime 2nd Season', ['Example Anime 3rd Season']), false);
  assert.equal(matchCatalogTitle('Kimi no Koto ga Daidaidaidaidaisuki na 100-nin no Kanojo 3rd Season',
    ['Kimi no Koto ga Dai Dai Dai Dai Daisuki na 100-nin no Kanojo 3rd Season']), true);
});

test('discovers a provider slug and stores it by MAL ID', async () => {
  const rows = new Map();
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => rows.get(values[0]) || null,
            run: async () => { rows.set(values[0], { animeav1_slug: values[1], jkanime_slug: values[2] }); }
          };
        }
      };
    }
  };
  const requests = [];
  const fetcher = async url => {
    requests.push(String(url));
    if (String(url).includes('/catalogo?search=')) {
      return new Response('<h3>Example Anime 3rd Season</h3><a href="/media/provider-name-third-season">Ver</a>', { status: 200 });
    }
    if (String(url).includes('/media/provider-name-third-season')) {
      return new Response('<a href="/media/provider-name-third-season/1">Episode</a>',
        { status: 200, headers: { 'content-type': 'text/html' } });
    }
    return new Response('Not found', { status: 404 });
  };
  const url = new URL('https://palmerita.test/api/anime-media');
  url.searchParams.set('malId', '123');
  url.searchParams.set('titles', JSON.stringify(['Example Anime 3rd Season']));
  const first = await (await resolveAnimeMedia(new Request(url), db, fetcher)).json();
  assert.equal(first.slug, 'provider-name-third-season');
  assert.deepEqual(first.availableEpisodes, [1]);
  assert.equal(rows.get(123).animeav1_slug, first.slug);

  requests.length = 0;
  const second = await (await resolveAnimeMedia(new Request(url), db, fetcher)).json();
  assert.equal(second.slug, first.slug);
  assert.equal(requests.some(request => request.includes('/catalogo?search=')), false);
});

test('player uses the JKAnime slug separately from AnimeAV1', async () => {
  const requests = [];
  const fetcher = async url => {
    requests.push(String(url));
    if (String(url).includes('jkanime.net/jk-title/1/')) {
      return new Response('<a data-id="0">VOE</a><script>video[0] = \'<iframe src="https://voe.sx/e/test"></iframe>\'</script>', { status: 200 });
    }
    return new Response('Not found', { status: 404 });
  };
  const response = await resolvePlayer(new Request('https://palmerita.test/api/player?slug=av1-title&jkSlug=jk-title&episode=1'), fetcher);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).players[0].provider, 'jkanime');
  assert.ok(requests.some(url => url.includes('jkanime.net/jk-title/1/')));
});

test('a provider outage is not reported as confirmed absence', async () => {
  const url = new URL('https://palmerita.test/api/anime-media');
  url.searchParams.set('malId', '456');
  url.searchParams.set('titles', JSON.stringify(['Example Anime']));
  const fetcher = async () => new Response('Unavailable', { status: 503 });
  const media = await (await resolveAnimeMedia(new Request(url), null, fetcher)).json();
  assert.equal(media.exists, false);
  assert.equal(media.verification, 'unknown');
  assert.deepEqual(media.availableEpisodes, []);
});

test('episode availability identifies the specific provider', async () => {
  const url = new URL('https://palmerita.test/api/anime-media');
  url.searchParams.set('malId', '789');
  url.searchParams.set('titles', JSON.stringify(['Example Anime']));
  const fetcher = async target => {
    if (String(target).includes('animeav1.com/media/example-anime')) {
      return new Response('<a href="/media/example-anime/1">1</a>',
        { status: 200, headers: { 'content-type': 'text/html' } });
    }
    if (String(target).includes('jkanime.net/example-anime/')) {
      return new Response('<span>Episodios:</span> 2', { status: 200 });
    }
    return new Response('Not found', { status: 404 });
  };
  const media = await (await resolveAnimeMedia(new Request(url), null, fetcher)).json();
  assert.deepEqual(media.episodesByProvider, { animeav1: [1], jkanime: [1, 2] });
  assert.deepEqual(media.availableEpisodes, [1, 2]);
});
