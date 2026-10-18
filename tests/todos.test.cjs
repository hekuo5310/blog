const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { build } = require('esbuild');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
const { JSDOM } = require('jsdom');
let app;
before(async () => {
  const b = await build({entryPoints:['src/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.txt':'text'}});
  const module = {exports:{}};
  vm.runInNewContext(b.outputFiles[0].text,{module,exports:module.exports,require,Request,Response,Headers,URL,URLSearchParams,TextEncoder,TextDecoder,ReadableStream,Uint8Array,crypto:webcrypto,console});
  app = module.exports.default;
});
function fixture() {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON');
  for(const p of fs.readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort()) db.exec(fs.readFileSync('migrations/'+p,'utf8'));
  const DB = {prepare(sql) {let args=[]; const s={bind(...v){args=v;return s},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}}}};return s},async batch(ss){db.exec('BEGIN');try{const r=[];for(const s of ss)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
  const env={DB,ADMIN_PASS:'local-test-only',SESSIONS:{async get(k){return k==='a'.repeat(64)?'1':null}}};
  const send=(path,{method='GET',data,admin=false,origin='https://blog.test',ip='192.0.2.1',headers={}}={})=>app.fetch(new Request('https://blog.test'+path,{method,headers:{DNT:'1',Origin:origin,'CF-Connecting-IP':ip,...(admin?{Cookie:'__Host-session='+'a'.repeat(64)}:{}),...(data!==undefined?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...headers},...(data!==undefined?{body:typeof data==='string'?data:new URLSearchParams(data).toString()}: {})}),env,{waitUntil(){}});
  const create=async (over={})=>{const r=await send('/admin/todos',{method:'POST',admin:true,data:{title:'A plan',body:'## Goal\n\n- [ ] Task',labels:'功能, 优先处理',status:'open',...over}});assert.equal(r.status,303);return Number(r.headers.get('Location').split('/').pop())};
  return {db,env,send,create};
}
test('only admin can create/edit/delete todos or templates; cross-origin writes are rejected',async()=>{
  const f=fixture();
  for(const path of ['/admin/todos','/admin/todos/templates','/admin/todos/1','/admin/todos/1/delete','/admin/todos/templates/1/delete']) {
    const r=await f.send(path,{method:'POST',data:{title:'bad'}});assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'/admin/login');
  }
  assert.equal((await f.send('/admin/todos',{method:'POST',admin:true,origin:'https://evil.test',data:{}})).status,302);
  assert.equal((await f.send('/todos/1/replies',{method:'POST',origin:'https://evil.test',data:{}})).status,403);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM todo_items').get().n,0);
});
test('admin creates from a template, edits labels/status and public list searches and filters',async()=>{
  const f=fixture();const form=await f.send('/admin/todos/new?template=1',{admin:true});assert.equal(form.status,200);assert.match(await form.text(),/描述希望实现的功能/);
  const key=await f.create();let r=await f.send('/todos');assert.equal(r.status,200);assert.match(await r.text(),/A plan/);
  r=await f.send('/admin/todos/'+key,{method:'POST',admin:true,data:{title:'Fixed',body:'details',labels:'修复，中文标签,修复',status:'closed',locked:'1'}});assert.equal(r.status,303);
  const row=f.db.prepare('SELECT * FROM todo_items WHERE id=?').get(key);assert.deepEqual(JSON.parse(row.labels),['修复','中文标签']);assert.equal(row.status,'closed');assert.equal(row.locked,1);
  assert.doesNotMatch(await (await f.send('/todos')).text(),/class="todo-title"/);
  assert.match(await (await f.send('/todos?status=closed&label='+encodeURIComponent('中文标签')+'&q=details')).text(),/Fixed/);
  assert.doesNotMatch(await (await f.send('/todos?status=all&label=absent')).text(),/class="todo-title"/);
  assert.equal((await f.send('/todos?status=__proto__')).status,400);
});
test('visitor replies, parent references, admin identity and public counts work with stored data',async()=>{
  const f=fixture(), key=await f.create();
  const reply=await f.send(`/todos/${key}/replies`,{method:'POST',data:{author:'Alice',body:'Looks good',is_admin:'1'}});assert.equal(reply.status,303);
  let row=f.db.prepare('SELECT * FROM todo_replies').get();assert.equal(row.is_admin,0);
  const parent=row.id;
  const admin=await f.send(`/todos/${key}/replies`,{method:'POST',admin:true,data:{author:'fake',body:'Thanks',parent_id:String(parent)}});assert.equal(admin.status,303);
  row=f.db.prepare('SELECT * FROM todo_replies ORDER BY id DESC').get();assert.equal(row.author,'管理员');assert.equal(row.is_admin,1);assert.equal(row.parent_id,parent);
  const html=await (await f.send(`/todos/${key}`)).text();assert.match(html,/Alice/);assert.match(html,/Looks good/);assert.match(html,/昵称未验证/);assert.match(html,/Thanks/);
  assert.match(await (await f.send('/todos')).text(),/2 条回复/);
  const other=await f.create({title:'Other'});
  assert.equal((await f.send(`/todos/${other}/replies`,{method:'POST',data:{author:'B',body:'wrong parent',parent_id:String(parent)},ip:'192.0.2.2'})).status,400);
});
test('atomic reply limits block concurrent submissions and enforce daily quota',async()=>{
  const f=fixture(),key=await f.create();
  const responses=await Promise.all(Array.from({length:5},()=>f.send(`/todos/${key}/replies`,{method:'POST',data:{author:'A',body:'hello'}})));
  assert.equal(responses.filter(x=>x.status===303).length,1);assert.equal(responses.filter(x=>x.status===429).length,4);
  const rate=f.db.prepare('SELECT * FROM todo_reply_limits').get();assert.match(rate.key,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(rate),/192\.0\.2/);
  f.db.prepare('UPDATE todo_reply_limits SET last_at=last_at-61,count=10').run();
  assert.equal((await f.send(`/todos/${key}/replies`,{method:'POST',data:{author:'A',body:'quota'}})).status,429);
  f.db.prepare("UPDATE todo_reply_limits SET day='2000-01-01'").run();
  assert.equal((await f.send(`/todos/${key}/replies`,{method:'POST',data:{author:'A',body:'new day'}})).status,303);
});
test('locking prevents visitor writes, admin can reply and delete individual replies or the issue',async()=>{
  const f=fixture(),key=await f.create({locked:'1'});
  assert.equal((await f.send(`/todos/${key}/replies`,{method:'POST',data:{author:'A',body:'hello'}})).status,403);
  assert.equal((await f.send(`/todos/${key}/replies`,{method:'POST',admin:true,data:{body:'admin'}})).status,303);
  assert.equal((await f.send(`/admin/todos/${key}/replies/1/delete`,{method:'POST',admin:true})).status,303);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM todo_replies').get().n,0);
  await f.send(`/todos/${key}/replies`,{method:'POST',admin:true,data:{body:'admin'}});
  assert.equal((await f.send(`/admin/todos/${key}/delete`,{method:'POST',admin:true})).status,303);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM todo_items').get().n,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM todo_replies').get().n,0);
  assert.equal((await f.send(`/todos/${key}`)).status,404);
});
test('template CRUD persists defaults without changing already-created items',async()=>{
  const f=fixture();
  assert.equal((await f.send('/admin/todos/templates',{method:'POST',admin:true,data:{name:'Release',title:'Version',body:'## Changes',labels:'版本'}})).status,303);
  const t=f.db.prepare('SELECT * FROM todo_templates ORDER BY id DESC').get();
  assert.equal((await f.send(`/admin/todos/templates/${t.id}`,{method:'POST',admin:true,data:{name:'Changed',title:'Updated',body:'New body',labels:'新'}})).status,303);
  assert.match(await (await f.send(`/admin/todos/new?template=${t.id}`,{admin:true})).text(),/New body/);
  assert.equal((await f.send(`/admin/todos/templates/${t.id}/delete`,{method:'POST',admin:true})).status,303);
  assert.equal(f.db.prepare('SELECT * FROM todo_templates WHERE id=?').get(t.id),undefined);
});
test('validation, oversized streams, markup escaping and SQL injection stay contained',async()=>{
  const f=fixture();
  for(const data of [{title:'',body:'x'},{title:'x',body:''},{title:'x',body:'b',status:'invalid'},{title:'x',body:'b',labels:'z'.repeat(31)}]) assert.equal((await f.send('/admin/todos',{method:'POST',admin:true,data})).status,400);
  assert.equal((await f.send('/admin/todos',{method:'POST',admin:true,data:'x='.repeat(100000),headers:{'Content-Length':'1'}})).status,413);
  const key=await f.create({title:'<img src=x onerror=alert(1)>',body:'<script>alert(1)</script>',labels:'<svg onload=alert(1)>'});
  const html=await (await f.send(`/todos/${key}`)).text(),dom=new JSDOM(html);
  assert.equal(dom.window.document.querySelector('h1 img'),null);assert.equal(dom.window.document.querySelector('.todo-markdown script'),null);
  assert.equal((await f.send('/todos?q='+encodeURIComponent("' OR 1=1; DROP TABLE todo_items;--"))).status,200);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM todo_items').get().n,1);
  const r=await f.send(`/todos/${key}/replies`,{method:'POST',data:{author:'a',body:'b',website:'spam'}});assert.equal(r.status,400);
});
test('public lists and replies paginate, parent deletion preserves replies, Markdown is sanitized in the DOM',async()=>{
  const f=fixture(),key=await f.create({body:'## Heading\n\n<img src=x onerror="alert(1)">\n<script>alert(2)</script>\n\n[bad](javascript:alert(3))'});
  const insert=f.db.prepare("INSERT INTO todo_items(title,body) VALUES (?,?)");for(let i=0;i<31;i++)insert.run('Extra '+i,'body');
  assert.match(await (await f.send('/todos')).text(),/下一页/);assert.match(await (await f.send('/todos?page=2')).text(),/上一页/);
  const add=f.db.prepare('INSERT INTO todo_replies(todo_id,author,body) VALUES (?,?,?)');for(let i=0;i<51;i++)add.run(key,'Visitor '+i,'Reply '+i);
  const first=await (await f.send(`/todos/${key}`)).text(),second=await (await f.send(`/todos/${key}?page=2`)).text();
  assert.match(first,/下一页/);assert.doesNotMatch(first,/id="reply-51"/);assert.match(second,/id="reply-51"/);
  f.db.prepare('UPDATE todo_replies SET parent_id=1 WHERE id=2').run();await f.send(`/admin/todos/${key}/replies/1/delete`,{method:'POST',admin:true});assert.equal(f.db.prepare('SELECT parent_id FROM todo_replies WHERE id=2').get().parent_id,null);
  const dom=new JSDOM(first,{runScripts:'outside-only'});
  dom.window.eval(fs.readFileSync('src/offline/marked.umd.js.txt','utf8'));dom.window.eval(fs.readFileSync('src/offline/purify.min.js.txt','utf8'));
  for(const s of dom.window.document.querySelectorAll('script'))if(s.textContent.includes('if(window.renderMarkdown)return')||s.textContent.includes("querySelectorAll('.todo-markdown')"))dom.window.eval(s.textContent);
  const body=dom.window.document.querySelector('.todo-markdown');assert.equal(body.querySelector('h2').textContent,'Heading');assert.equal(body.querySelector('script'),null);assert.equal(body.querySelector('[onerror]'),null);assert.equal(body.querySelector('a[href^="javascript:"]'),null);
  assert.match(first,/var\(--bg\)/);assert.match(first,/@media\(max-width:600px\)/);dom.window.close();
});
test('frontend detects admin session and exposes frontend management pages without leaking controls to visitors',async()=>{
  const f=fixture(),key=await f.create();
  const publicList=await f.send('/todos'),adminList=await f.send('/todos',{admin:true});
  assert.equal(adminList.headers.get('Cache-Control'),'no-store');
  const guest=await publicList.text(),admin=await adminList.text();
  assert.doesNotMatch(guest,/href="\/todos\/new"/);assert.doesNotMatch(guest,/href="\/todos\/\d+\/edit"/);
  assert.match(admin,/href="\/todos\/new"/);assert.match(admin,/href="\/todos\/templates"/);assert.match(admin,new RegExp('href="/todos/'+key+'/edit"'));
  for(const path of ['/todos/new','/todos/templates',`/todos/${key}/edit`]) {
    assert.equal((await f.send(path)).status,302);
    const r=await f.send(path,{admin:true});assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.match(await r.text(),/class="nav-report" href="\/todos"/);
  }
  const detail=await (await f.send(`/todos/${key}`,{admin:true})).text();assert.match(detail,/设为已完成/);assert.match(detail,/锁定讨论/);
  assert.doesNotMatch(await (await f.send(`/todos/${key}`)).text(),/aria-label="管理员操作"/);
});
test('frontend state actions are authenticated, CSRF protected and redirect back to the detail',async()=>{
  const f=fixture(),key=await f.create(),path=`/admin/todos/${key}/state`;
  assert.equal((await f.send(path,{method:'POST',data:{status:'closed'}})).status,302);
  assert.equal((await f.send(path,{method:'POST',admin:true,origin:'https://evil.test',data:{status:'closed'}})).status,302);
  for(const data of [{status:'closed'},{status:'in_progress'},{status:'open'},{locked:'1'},{locked:'0'}]) {
    const r=await f.send(path,{method:'POST',admin:true,data});assert.equal(r.status,303);assert.equal(r.headers.get('Location'),`/todos/${key}`);
    const row=f.db.prepare('SELECT * FROM todo_items WHERE id=?').get(key);if(data.status)assert.equal(row.status,data.status);if(data.locked)assert.equal(row.locked,Number(data.locked));
  }
  assert.equal((await f.send(path,{method:'POST',admin:true,data:{status:'bad'}})).status,400);
  assert.equal((await f.send(path,{method:'POST',admin:true,data:{status:'closed',locked:'1'}})).status,400);
  const save=await f.send('/admin/todos/templates',{method:'POST',admin:true,data:{name:'Front',title:'',body:'Details',frontend:'1'}});assert.equal(save.headers.get('Location'),'/todos/templates');
  const t=f.db.prepare('SELECT id FROM todo_templates ORDER BY id DESC').get();
  const del=await f.send(`/admin/todos/templates/${t.id}/delete`,{method:'POST',admin:true,data:{frontend:'1'}});assert.equal(del.headers.get('Location'),'/todos/templates');
  const deletion=await f.send(`/admin/todos/${key}/delete`,{method:'POST',admin:true,data:{frontend:'1'}});assert.equal(deletion.headers.get('Location'),'/todos');
});
