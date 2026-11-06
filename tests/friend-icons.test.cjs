const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const {Miniflare,createFetchMock}=require('miniflare');
let mf,mock;
before(async()=>{
  const result=await build({stdin:{contents:`import {readHeadIcon,resolveFriendIcon,publicIconUrl} from './src/friend-icons'; export default {async fetch(request){const data=await request.json();return Response.json(data.action==='resolve'?await resolveFriendIcon(data.url):data.action==='safe'?publicIconUrl(data.url)?.href||null:await readHeadIcon(data.html,data.url))}}`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',write:false,loader:{'.txt':'text'}});
  mock=createFetchMock();mock.disableNetConnect();
  mf=new Miniflare({modules:true,script:result.outputFiles[0].text,compatibilityDate:'2024-09-23',fetchMock:mock});
});
after(async()=>{await mf?.dispose();await mock?.close()});
async function run(data){return (await mf.dispatchFetch('https://worker.example/',{method:'POST',body:JSON.stringify(data)})).json()}
test('native HTMLRewriter reads icons only in head, resolves base/relative URLs and prefers ordinary icons',async()=>{
  assert.equal(await run({url:'https://blog.example/articles/post',html:'<!doctype html><head><base href="/static/"><link rel="apple-touch-icon" href="apple.png"><link href="icon.svg?a=1&amp;b=2" rel="shortcut ICON"></head><body><link rel="icon" href="https://wrong.example/evil.png"></body>'}),'https://blog.example/static/icon.svg?a=1&b=2');
  assert.equal(await run({url:'https://blog.example/',html:'<head><link rel="icon" href="data:image/png,x"><link rel="icon" href="//cdn.example/favicon.png"></head>'}),'https://cdn.example/favicon.png');
  assert.equal(await run({url:'https://blog.example/',html:'<head></head><body><link rel="icon" href="/bad.ico"></body>'}),null);
});
test('resolver follows bounded redirects and reads the final page head',async()=>{
  mock.get('https://friend.example').intercept({path:'/old',method:'GET'}).reply(301,'',{headers:{Location:'/new'}});
  mock.get('https://friend.example').intercept({path:'/new',method:'GET'}).reply(200,'<head><link rel="icon" href="assets/icon.png"></head>',{headers:{'Content-Type':'text/html'}});
  assert.equal(await run({action:'resolve',url:'https://friend.example/old'}),'https://friend.example/assets/icon.png');
  mock.get('https://friend.example').intercept({path:'/private'}).reply(302,'',{headers:{Location:'http://127.0.0.1/private'}});
  assert.equal(await run({action:'resolve',url:'https://friend.example/private'}),null);
  mock.get('https://friend.example').intercept({path:'/oversized'}).reply(200,'x'.repeat(150000),{headers:{'Content-Type':'text/html'}});
  assert.equal(await run({action:'resolve',url:'https://friend.example/oversized'}),null);
  for(const url of ['http://127.0.0.1','http://localhost','http://internal.local','https://user:pass@example.com','http://[::1]/','file:///etc/passwd'])assert.equal(await run({action:'safe',url}),null);
});
