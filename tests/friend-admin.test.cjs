const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {build}=require('esbuild');
const {webcrypto}=require('node:crypto');
const fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
let app;const upstreamCalls=[];
before(async()=>{
  const b=await build({entryPoints:['src/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.txt':'text'}}),module={exports:{}};
  vm.runInNewContext(b.outputFiles[0].text,{module,exports:module.exports,require,Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,ReadableStream,Uint8Array,AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{upstreamCalls.push({url,options});return new Response('not found',{status:404})},crypto:webcrypto,console});app=module.exports.default;
});
function fixture(){
  const db=new DatabaseSync(':memory:');for(const p of fs.readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort())db.exec(fs.readFileSync('migrations/'+p,'utf8'));
  const legacy='**友链拯救世界！**\n\n- [Old](https://old.example/)', env={SESSIONS:{async get(k){return k==='a'.repeat(64)?'1':null}},DB:{prepare(sql){let args=[];const s={bind(...v){args=v;return s},async all(){return {results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)||null},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}};return s}}};
  db.prepare('INSERT INTO pages(title,slug,body,published) VALUES (?,?,?,1)').run('友链','friend-link',legacy);
  const send=(path,{method='GET',data,admin=true,origin='https://blog.test',headers={}}={})=>app.fetch(new Request('https://blog.test'+path,{method,headers:{DNT:'1',Origin:origin,...(admin?{Cookie:'__Host-session='+'a'.repeat(64)}:{}),...(data!==undefined?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...headers},...(data!==undefined?{body:typeof data==='string'?data:new URLSearchParams(data)}:{})}),env,{waitUntil(){}});
  const stamp=async()=>{const dom=new JSDOM(await (await send('/admin/friend-links/new')).text());const value=dom.window.document.querySelector('[name=revision]').value;dom.window.close();return value};
  const stored=()=>db.prepare("SELECT body FROM pages WHERE slug='friend-link'").get().body;
  return {db,send,stamp,stored,legacy};
}
const fields={name:'New friend',url:'https://new.test/path',avatar:'',description:'A small blog',order:'0'};
test('public icon lookup only fetches configured published entries without forwarding visitor credentials',async()=>{
  const f=fixture();upstreamCalls.length=0;
  assert.equal((await f.send('/api/friend-icon/missing?site=https://attacker.example/')).status,404);assert.equal(upstreamCalls.length,0);
  const r=await f.send('/api/friend-icon/legacy-0?site=https://attacker.example/');assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'https://old.example/favicon.ico');assert.equal(upstreamCalls.length,1);
  assert.equal(upstreamCalls[0].url,'https://old.example/');assert.equal(upstreamCalls[0].options.headers.Cookie,undefined);assert.equal(upstreamCalls[0].options.headers.Authorization,undefined);
  f.db.prepare('UPDATE pages SET published=0').run();assert.equal((await f.send('/api/friend-icon/legacy-0')).status,404);
});
test('normal forms migrate legacy links on save, then edit, order, delete and render publicly',async()=>{
  const f=fixture(),base='/admin/friend-links';
  const initial=await (await f.send(base)).text();assert.match(initial,/Old/);assert.match(initial,/新增友链/);assert.equal(f.stored(),f.legacy);
  assert.equal((await f.send('/admin/page/1/edit')).headers.get('Location'),base);
  let r=await f.send(base,{method:'POST',data:{...fields,revision:await f.stamp()}});assert.equal(r.status,303);
  let saved=JSON.parse(f.stored());assert.equal(saved.type,'friend-links');assert.equal(saved.entries.length,2);assert.equal(saved.entries[0].name,'Old');assert.match(saved.intro,/友链拯救世界/);
  const entry=saved.entries[1];assert.match(entry.id,/^[a-f0-9-]{36}$/);
  assert.match(await (await f.send(`${base}/${entry.id}/edit`)).text(),/头像地址/);
  r=await f.send(`${base}/${entry.id}`,{method:'POST',data:{...fields,name:'Changed',avatar:'https://img.test/avatar.png',order:'1',revision:await f.stamp()}});assert.equal(r.status,303);
  saved=JSON.parse(f.stored());assert.equal(saved.entries[1].name,'Changed');assert.equal(saved.entries[1].avatar,'https://img.test/avatar.png');
  const publicHtml=await (await f.send('/p/friend-link',{admin:false})).text();assert.match(publicHtml,/Changed/);assert.match(publicHtml,/\/api\/friend-icon\/legacy-0/);assert.match(publicHtml,/https:\/\/img.test\/avatar.png/);
  r=await f.send(`${base}/${entry.id}/delete`,{method:'POST',data:{revision:await f.stamp()}});assert.equal(r.status,303);assert.equal(JSON.parse(f.stored()).entries.length,1);
});
test('session/CSRF protection, validation, stale forms and byte limits protect friend management',async()=>{
  const f=fixture(),base='/admin/friend-links',revision=await f.stamp();
  for(const path of [base,base+'/new',base+'/legacy-0/edit'])assert.equal((await f.send(path,{admin:false})).status,302);
  for(const path of [base,base+'/legacy-0',base+'/legacy-0/delete']){
    assert.equal((await f.send(path,{method:'POST',admin:false,data:{...fields,revision}})).status,302);
    assert.equal((await f.send(path,{method:'POST',origin:'https://evil.test',data:{...fields,revision}})).status,302);
  }
  for(const over of [{url:'javascript:alert(1)'},{url:'https://a:b@example.test'},{avatar:'data:text/html,x'},{order:'-1'},{name:''}])assert.equal((await f.send(base,{method:'POST',data:{...fields,...over,revision}})).status,400);
  assert.equal((await f.send(base,{method:'POST',data:{...fields,revision:'stale'}})).status,409);
  assert.equal((await f.send(base,{method:'POST',data:'x='.repeat(20000),headers:{'Content-Length':'1'}})).status,413);
  const results=await Promise.all(['A','B'].map(name=>f.send(base,{method:'POST',data:{...fields,name,revision}})));assert.deepEqual(results.map(r=>r.status).sort(),[303,409]);assert.equal(JSON.parse(f.stored()).entries.length,2);
  assert.equal((await f.send('/admin/page/1',{method:'POST',data:{title:'overwrite',slug:'friend-link',body:'wrong'}})).headers.get('Location'),base);assert.equal(JSON.parse(f.stored()).entries.length,2);
});
