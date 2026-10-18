const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
const { JSDOM } = require('jsdom');
let createRoutes, view;
before(async()=>{
  const b=await build({entryPoints:['src/todo-giscus.ts'],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.txt':'text'}});
  createRoutes = fetcher => {const module={exports:{}};vm.runInNewContext(b.outputFiles[0].text,{module,exports:module.exports,require,Request,Response,Headers,URL,URLSearchParams,Uint8Array,TextEncoder,TextDecoder,AbortController,setTimeout,clearTimeout,fetch:fetcher});return module.exports.todoGiscusRoutes()};
  const v=await build({entryPoints:['src/todos-view.ts'],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.txt':'text'}});const module={exports:{}};vm.runInNewContext(v.outputFiles[0].text,{module,exports:module.exports,require,URLSearchParams});view=module.exports;
});
function fixture() {
  const calls=[],item={id:1,title:'Renamable title',body:'Task',labels:'[]',locked:0,status:'open',created_at:'2026-10-18 00:00:00',updated_at:'2026-10-18 00:00:00'};
  let response={status:404,data:{error:'Discussion not found'}};
  const app=createRoutes(async(url,init)=>{calls.push({url,init});const r=typeof response==='function'?response(url,init):response;return Response.json(r.data,{status:r.status})});
  const env={GISCUS_REPO:'owner/blog',GISCUS_REPO_ID:'repo-id',GISCUS_CATEGORY:'Todos',GISCUS_CATEGORY_ID:'category-id',DB:{prepare(){return {bind(){return {async first(){return item}}}}}}};
  const send=(path,method='GET',body,extra={})=>app.fetch(new Request('https://blog.test'+path,{method,headers:{Origin:'https://blog.test','Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
  return {calls,item,env,send,setResponse(r){response=r}};
}
test('Giscus read uses fixed repo/category/strict ID mapping, paginates and maps missing discussion to empty',async()=>{
 const f=fixture(),r=await f.send('/api/todo-giscus/1?after=cursor&repo=evil/repo');assert.equal(r.status,200);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal((await r.json()).discussion,null);
 const url=new URL(f.calls[0].url);assert.equal(url.origin,'https://giscus.app');assert.equal(url.searchParams.get('repo'),'owner/blog');assert.equal(url.searchParams.get('term'),'blog/todos/1');assert.equal(url.searchParams.get('strict'),'true');assert.equal(url.searchParams.get('after'),'cursor');
 f.item.title='New title';await f.send('/api/todo-giscus/1');assert.equal(new URL(f.calls[1].url).searchParams.get('term'),'blog/todos/1');
});
test('token exchange is same-origin, bounded, never cached and forwards only the opaque session',async()=>{
 const f=fixture();assert.equal((await f.send('/api/todo-giscus/token','POST',{session:'opaque'},{Origin:'https://evil.test'})).status,403);assert.equal(f.calls.length,0);
 assert.equal((await f.send('/api/todo-giscus/token','POST',{session:'x'.repeat(21000)})).status,400);assert.equal(f.calls.length,0);
 f.setResponse({status:200,data:{token:'temporary-test-token'}});const r=await f.send('/api/todo-giscus/token','POST',{session:'opaque',unexpected:'ignored'});assert.equal(r.status,200);assert.deepEqual(await r.json(),{token:'temporary-test-token'});assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(JSON.parse(f.calls[0].init.body),{session:'opaque'});
});
test('create requires GitHub auth, refuses local locks, checks existing mapping and ignores client injection',async()=>{
 const f=fixture();assert.equal((await f.send('/api/todo-giscus/1','POST',{})).status,401);
 const auth={Authorization:'Bearer test-user-token'};f.item.locked=1;assert.equal((await f.send('/api/todo-giscus/1','POST',{},auth)).status,403);f.item.locked=0;
 f.setResponse((url)=>url.includes('/api/discussions?')?{status:404,data:{}}:{status:200,data:{id:'new-discussion'}});
 const r=await f.send('/api/todo-giscus/1','POST',{repo:'evil',input:{title:'evil'}},auth);assert.equal(r.status,200);assert.equal(f.calls.length,2);
 const b=JSON.parse(f.calls[1].init.body);assert.equal(b.repo,'owner/blog');assert.equal(b.input.title,'blog/todos/1');assert.equal(b.input.categoryId,'category-id');
 f.calls.length=0;f.setResponse({status:200,data:{discussion:{id:'existing'}}});assert.deepEqual(await (await f.send('/api/todo-giscus/1','POST',{},auth)).json(),{id:'existing'});assert.equal(f.calls.length,1);
});
test('MIT notice is accessible and OAuth callback validates nonce without external assets',async()=>{
 const f=fixture();const license=await f.send('/assets/todo-giscus-LICENSE.txt');assert.match(await license.text(),/MIT License/);
 const callback=await (await f.send('/api/todo-giscus/callback')).text();assert.match(callback,/state!==pending.state/);assert.match(callback,/history.replaceState/);assert.doesNotMatch(callback,/<script src=/);
});
test('native Issues UI safely renders Giscus data, reactions and nested replies, preserves old comments',async()=>{
 const f=fixture();const html=view.todoDetail(f.item,[],1,false,{title:'Blog',desc:'',navLinks:[]},false,'',null,true);
 assert.match(html,/Giscus MIT 许可证/);assert.doesNotMatch(html,/name="author"/);assert.match(html,/todo-giscus-api.js/);
 const dom=new JSDOM(html,{url:'https://blog.test/todos/1',runScripts:'outside-only'}),w=dom.window;
 w.eval(fs.readFileSync('src/offline/marked.umd.js.txt','utf8'));w.eval(fs.readFileSync('src/offline/purify.min.js.txt','utf8'));
 const comment={id:'DC_1',author:{login:'<img src=x onerror=alert(1)>',url:'https://github.com/a'},createdAt:'2026-10-18T00:00:00Z',bodyHTML:'<p>Hi<img src=x onerror="alert(1)"><script>alert(1)</script></p>',url:'https://github.com/owner/blog/discussions/1',reactions:{},replies:[]};
 w.BlogGiscusAPI={async load(){return {viewer:null,discussion:{id:'D_1',url:'https://github.com/owner/blog/discussions/1',comments:[comment],pageInfo:{hasNextPage:false},totalCommentCount:1}}}};
 w.eval(fs.readFileSync('src/todo-giscus-client.js.txt','utf8'));await new Promise(r=>setTimeout(r,0));
 const root=w.document.getElementById('giscus-discussion');assert.equal(root.querySelector('.gc-body script'),null);assert.equal(root.querySelector('.gc-body [onerror]'),null);assert.equal(root.querySelector('.gc-comment-head div img'),null);assert.equal(root.querySelector('[data-count]').textContent,'1');assert.equal(root.querySelector('textarea').disabled,true);dom.window.close();
});
test('upstream failures are generic and invalid OAuth state never stores a session',async()=>{
 const f=fixture();f.setResponse(()=>{throw Error('private upstream detail')});const r=await f.send('/api/todo-giscus/1');assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private upstream detail/);
 const fresh=fixture(),callback=await (await fresh.send('/api/todo-giscus/callback')).text();
 const dom=new JSDOM(callback,{url:'https://blog.test/api/todo-giscus/callback?state=wrong&giscus=opaque',runScripts:'outside-only'});
 dom.window.sessionStorage.setItem('todo-giscus-pending',JSON.stringify({state:'correct',id:'1',at:Date.now()}));
 dom.window.eval(dom.window.document.querySelector('script').textContent);
 assert.equal(dom.window.sessionStorage.getItem('todo-giscus-session'),null);assert.equal(dom.window.sessionStorage.getItem('todo-giscus-pending'),null);assert.equal(dom.window.location.search,'');assert.match(dom.window.document.getElementById('status').textContent,/授权状态失效/);dom.window.close();
});
