import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractPlayers,extractDirectVideo,validEmbed,resolvePlayer,extractMediaEpisodes,resolveMedia} from './worker.mjs';
test('only real supported embeds are returned and deduplicated',()=>{
 const html='<iframe src="https://voe.sx/e/abc"></iframe><iframe src="https://ads.example/video"></iframe>{server:"Voe",url:"https://voe.sx/e/abc"}{server:"Mega",url:"https://mega.nz/file/abc"}';
 assert.deepEqual(extractPlayers(html),[{url:'https://voe.sx/e/abc',name:'Principal'}]);
 assert.equal(validEmbed('https://voe.sx.evil.example/e/x'),false);
 assert.equal(validEmbed('http://voe.sx/e/x'),false);
 assert.equal(validEmbed('https://user:pass@voe.sx/e/x'),false);
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
 const r=await resolvePlayer(new Request('https://local/api/player?slug=one-piece&episode=2'),async(url,options)=>{
 assert.equal(url,'https://animeav1.com/media/one-piece/2'); assert.equal(options.redirect,'manual');
 return new Response('<iframe src="https://voe.sx/e/episode2"></iframe>',{headers:{'Content-Type':'text/html'}});
 });
 assert.equal(r.status,200); assert.equal((await r.json()).players[0].url,'https://voe.sx/e/episode2');
});

