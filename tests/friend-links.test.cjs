const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const vm=require('node:vm');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
let html,links;
before(async()=>{
  async function load(entry){
    const b=await build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',write:false,loader:{'.txt':'text'}});
    const module={exports:{}};vm.runInNewContext(b.outputFiles[0].text,{module,exports:module.exports,require,URL,console});return module.exports;
  }
  html=await load('src/html.ts');links=await load('src/friend-links.ts');
});
const cfg={title:'我的博客',desc:'记录生活与代码',navLinks:[]};
const entries=[['Vincentzyu233','https://vincentzyu233.github.io/VincentZyu233/'],['Fengzi','https://fzz.ccwu.cc/'],["Norcleeh\'s Site",'https://nocp.space/'],['天狗的博客','https://tengu.l2.ink/'],['苏的小站','https://suyihang15.com/'],['???','https://records.zerexa.net']];
const body='**友链拯救世界！**\n\n'+entries.map(([name,url])=>`- [${name}](${url})`).join('\n');
const page={id:1,slug:'friend-link',title:'友链',body,published:1,created_at:'2026-11-06 00:00:00'};
test('existing Markdown renders all six friend cards server-side without changing names or destinations',()=>{
  const doc=new JSDOM(html.pageDetail(page,cfg)).window.document;
  const cards=[...doc.querySelectorAll('.friend-card')];assert.equal(cards.length,6);
  entries.forEach(([name,url],i)=>{assert.equal(cards[i].querySelector('.friend-card-name').textContent,name);assert.equal(cards[i].href,new URL(url).href);assert.equal(cards[i].target,'_blank');assert.match(cards[i].rel,/noopener/);});
  assert.match(doc.querySelector('.friends-intro').textContent,/友链拯救世界/);
  assert.equal(doc.querySelector('[data-friend-site-name]').textContent,cfg.title);
  assert.equal(doc.querySelector('[data-friend-site-description]').textContent,cfg.desc);
  assert.match(doc.querySelector('style:last-of-type').textContent,/grid-template-columns:minmax\(0,1fr\)/);
  assert.match(html.pageDetail(page,cfg),/var\(--surface\)/);
  assert.doesNotMatch(html.pageDetail({...page,slug:'about'},cfg),/class="friend-card"/);
});
test('editor supports explicit images and descriptions; unsafe URLs and mixed content remain in Markdown',()=>{
  const parsed=links.parseFriendLinks('A note\n\n- [![avatar](https://images.test/a.png) **Alice**](https://alice.test/path) — A small blog\n\n## More\n\n- [Bad](javascript:alert)\n- Keep this item\n\n- [Local](/admin)\n\n- [Parent](https://parent.test)\n  - Nested note');
  assert.equal(parsed.friends.length,1);assert.equal(parsed.friends[0].name,'Alice');assert.equal(parsed.friends[0].icon,'https://images.test/a.png');assert.equal(parsed.friends[0].description,'A small blog');
  for(const text of ['A note','## More','[Bad]','Keep this item','[Local]','Nested note'])assert.ok(parsed.prose.includes(text));
  const untrusted=html.pageDetail({...page,title:'<img src=x onerror=alert(1)>',body:'- [<script>alert(1)</script> X](https://safe.test) — <img src=x onerror=alert(1)>'},{...cfg,title:'</script><script>alert(1)</script>'});
  const doc=new JSDOM(untrusted).window.document;
  assert.equal(doc.querySelector('h1 img'),null);assert.equal(doc.querySelector('.friend-card script'),null);assert.equal(doc.querySelector('.friend-card [onerror]'),null);
  assert.equal(doc.querySelector('[data-friend-site-name] script'),null);
  assert.equal(links.parseFriendLinks('- [Secret](https://user:password@example.test)').friends.length,0);
});
test('client renders prose, falls back on missing icons and copies actual site settings/origin',async()=>{
  const dom=new JSDOM(html.pageDetail(page,cfg),{url:'https://www.io.hk.cn/p/friend-link',runScripts:'outside-only'}),w=dom.window;
  w.eval(fs.readFileSync('src/offline/marked.umd.js.txt','utf8'));w.eval(fs.readFileSync('src/offline/purify.min.js.txt','utf8'));
  const scripts=[...w.document.querySelectorAll('script:not([src])')];
  w.eval(scripts.find(s=>s.textContent.includes('if(window.renderMarkdown)return')).textContent);
  let copied;Object.defineProperty(w.navigator,'clipboard',{configurable:true,value:{async writeText(value){copied=value}}});
  w.eval(fs.readFileSync('src/friend-links-client.js.txt','utf8'));
  assert.equal(w.document.querySelector('.friends-intro strong').textContent,'友链拯救世界！');
  const image=w.document.querySelector('.friend-icon img');image.dispatchEvent(new w.Event('error'));assert.equal(image.hidden,true);
  const button=w.document.querySelector('[data-friend-copy]');assert.equal(button.hidden,false);button.click();await new Promise(r=>setImmediate(r));
  assert.equal(copied,'名称：我的博客\n简介：记录生活与代码\n网址：https://www.io.hk.cn/');
  assert.match(w.document.querySelector('[data-friend-copy-status]').textContent,/已复制/);
  w.navigator.clipboard.writeText=async()=>{throw Error('denied')};button.click();await new Promise(r=>setImmediate(r));assert.match(w.document.querySelector('[data-friend-copy-status]').textContent,/手动复制/);dom.window.close();
});
test('structured entries preserve order and avatar uses site favicon after a load failure',()=>{
  const document={type:'friend-links',version:1,intro:'Hello',entries:[{id:'first',name:'A',url:'https://a.test/path',avatar:'https://images.test/a.png',description:'A blog',order:2},{id:'second',name:'B',url:'https://b.test/',avatar:'',description:'',order:1}]};
  const parsed=links.parseFriendLinks(JSON.stringify(document));assert.equal(parsed.friends[0].name,'B');assert.equal(parsed.friends[0].icon,'https://b.test/favicon.ico');assert.equal(parsed.prose,'Hello');
  const dom=new JSDOM(html.pageDetail({...page,body:JSON.stringify(document)},cfg),{url:'https://blog.test/p/friend-link',runScripts:'outside-only'}),w=dom.window;
  w.eval(fs.readFileSync('src/friend-links-client.js.txt','utf8'));
  const image=w.document.querySelector('a[href="https://a.test/path"] img');image.dispatchEvent(new w.Event('error'));assert.equal(image.src,'https://a.test/favicon.ico');
  image.dispatchEvent(new w.Event('error'));assert.equal(image.hidden,true);dom.window.close();
});
