import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractPlayers,extractDirectVideo,validEmbed,resolvePlayer} from './worker.mjs';
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
test('resolver returns extracted embed and exact episode source',async()=>{
 const r=await resolvePlayer(new Request('https://local/api/player?slug=one-piece&episode=2'),async(url,options)=>{
 assert.equal(url,'https://animeav1.com/media/one-piece/2'); assert.equal(options.redirect,'manual');
 return new Response('<iframe src="https://voe.sx/e/episode2"></iframe>',{headers:{'Content-Type':'text/html'}});
 });
 assert.equal(r.status,200); assert.equal((await r.json()).players[0].url,'https://voe.sx/e/episode2');
});
