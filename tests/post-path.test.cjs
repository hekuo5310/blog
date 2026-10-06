const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
let posts, app, html;
const slug = 'notes/20260227/844880';
const article = {id:1,title:'Path test',slug,body:'Hello',published:1,created_at:'2026-10-06 00:00:00',license:'CC BY-NC-SA 4.0',custom_license_name:'',custom_license_text:'',tags:'[]'};
before(async () => {
  async function load(entry) {
    const b = await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.txt':'text'}});
    const module = {exports:{}};
    vm.runInNewContext(b.outputFiles[0].text,{module,exports:module.exports,require,Request,Response,Headers,URL,TextEncoder,TextDecoder,Uint8Array,ReadableStream,CompressionStream,crypto:webcrypto,console});
    return module.exports;
  }
  posts = await load('src/posts.ts'); app = (await load('src/index.ts')).default; html = await load('src/html.ts');
});
function fixture(collision = false) {
  const writes=[];
  const DB={prepare(sql){return {bind(...args){return {async first(){if(sql.startsWith('SELECT 1')) return collision && args[0]===slug ? {found:1} : null;return args[0]===slug?article:null},async run(){writes.push({sql,args})}}}}},async batch(statements){for(const s of statements)await s.run()}};
  return {c:{env:{DB}},DB,writes};
}
test('create and edit preserve directory separators; duplicates suffix only the final name',async()=>{
  const license={license:'CC BY-NC-SA 4.0',customName:'',customText:''};
  const f=fixture();assert.equal(await posts.createPost(f.c,article.title,slug,article.body,null,license),slug);assert.equal(f.writes[0].args[1],slug);
  await posts.updatePost(f.c,{...article,slug:'notes20260227844880'},article.title,slug,article.body,null,license);
  assert.equal(f.writes.find(x=>x.sql.startsWith('UPDATE posts')).args[1],slug);
  assert.equal(await posts.createPost(fixture(true).c,article.title,slug,article.body,null,license),slug+'-2');
});
test('nested and legacy encoded article URLs resolve, missing nested path returns 404',async()=>{
  const f=fixture();const env={DB:f.DB,SESSIONS:{async get(){return null}}};
  for(const path of ['/post/'+slug,'/post/'+encodeURIComponent(slug)]){
    const r=await app.fetch(new Request('https://blog.test'+path,{headers:{DNT:'1'}}),env,{waitUntil(){}});
    assert.equal(r.status,200,path);assert.match(await r.text(),/Path test/);
  }
  const missing=await app.fetch(new Request('https://blog.test/post/notes/missing',{headers:{DNT:'1'}}),env,{waitUntil(){}});assert.equal(missing.status,404);
});
test('article lists and update feed retain slash-separated URLs',()=>{
  assert.match(html.postList([article],[]),/href="\/post\/notes\/20260227\/844880"/);
  assert.match(html.searchPage('Path',[article]),/href="\/post\/notes\/20260227\/844880"/);
});
