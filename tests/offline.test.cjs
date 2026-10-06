const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
const source = fs.readFileSync('src/offline/sw.js.txt', 'utf8');
function harness(pack) {
  const stores = new Map(); const handlers = {}; let current = pack.version; let offline = false; let failPut = false;
  const network = [];
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map()); const store = stores.get(name);
      return { async match(key) { return store.get(key)?.clone(); }, async put(key, response) { if (failPut && name.includes('content')) throw Error('quota'); store.set(key, response.clone()); }, async delete(key) { return store.delete(key); } };
    }, async keys() { return [...stores.keys()]; }, async delete(name) { return stores.delete(name); },
  };
  vm.runInNewContext(source, { self: { location: { origin: 'https://blog.test' }, clients: { async matchAll() { return []; }, async claim() {} }, skipWaiting() {}, addEventListener(type, fn) { handlers[type] = fn; } }, caches, URL, Response, Request, Uint8Array, AbortController, setTimeout, clearTimeout, DecompressionStream, atob,
    async fetch(input) {
      const url = typeof input === 'string' ? input : input.url; network.push(url);
      if (offline) throw Error('offline');
      if (url.endsWith('/offline/version')) return Response.json({ version: current });
      if (url.endsWith('/offline/archive')) return new Response(new Response(JSON.stringify(pack)).body.pipeThrough(new CompressionStream('gzip')));
      return new Response('NETWORK');
    },
  });
  return { stores, network, setVersion(v) { current = v; }, setOffline(v) { offline = v; }, failPut() { failPut = true; },
    async message(type) { let done; const result = new Promise(r => done = r); handlers.message({ data: { type }, ports: [{ postMessage: done }], waitUntil() {} }); return result; },
    async request(path, navigate = false, method = 'GET') {
      let response;
      handlers.fetch({ request: { url: 'https://blog.test' + path, method, mode: navigate ? 'navigate' : 'cors' }, respondWith(r) { response = r; } });
      return response ? (await response) : null;
    },
  };
}
const makePack = () => ({ version: 'a'.repeat(64), entries: [
  { path: '/', type: 'text/html', body: 'HOME' }, { path: '/post/test', type: 'text/html', body: 'ARTICLE' },
  { path: '/offline/client.js', type: 'text/javascript', body: 'client' },
  { path: '/search', type: 'text/html', body: '<input name="q" value=""><p class="search-result-summary"></p>' },
  { path: '/offline/search.json', type: 'application/json', body: JSON.stringify([{ title: 'Hello', body: 'world', html: '<article>result</article>' }]) },
] });
test('complete archive supports offline reload/search; admin, reports, writes and other origins bypass cache', async () => {
  const h = harness(makePack()); assert.equal((await h.message('enable')).ok, true); h.setOffline(true);
  assert.equal(await (await h.request('/post/test', true)).text(), 'ARTICLE');
  assert.match(await (await h.request('/search?q=world', true)).text(), /<article>result<\/article>/);
  assert.equal(await h.request('/admin'), null); assert.equal(await h.request('/stats'), null); assert.equal(await h.request('/post/test', false, 'POST'), null);
  assert.equal((await h.request('/post/missing', true)).status, 404);
});
test('version change clears old content and uses network', async () => {
  const h = harness(makePack()); await h.message('enable'); h.setVersion('b'.repeat(64));
  assert.equal(await (await h.request('/', true)).text(), 'NETWORK');
  assert.equal((await h.message('state')).state, null); assert.equal([...h.stores.keys()].filter(n => n.includes('content')).length, 0);
});
test('manual disable removes cache and uses network', async () => {
  const h = harness(makePack()); await h.message('enable'); await h.message('disable'); assert.equal((await h.message('state')).state, null);
  assert.equal(await (await h.request('/', true)).text(), 'NETWORK');
});
test('quota failure never enables incomplete archive', async () => {
  const h = harness(makePack()); h.failPut(); assert.equal((await h.message('enable')).ok, false); assert.equal((await h.message('state')).state, null);
});
test('archive rejects admin entries and stale download', async () => {
  const p = makePack(); p.entries.push({ path: '/admin', type: 'text/html', body: 'SECRET' });
  const h = harness(p); assert.equal((await h.message('enable')).ok, false); assert.equal((await h.message('state')).state, null);
  const stale = harness(makePack()); stale.setVersion('b'.repeat(64)); assert.equal((await stale.message('enable')).ok, false);
});
test('evicted content resets offline state', async () => {
  const h = harness(makePack()); await h.message('enable'); for (const name of h.stores.keys()) if (name.includes('content')) h.stores.delete(name);
  assert.equal((await h.message('check')).state, null);
});
test('direct admin navigation checks version and never serves stale editor assets', async () => {
  const pack = makePack(); pack.entries.push({ path: '/offline/marked.js', type: 'text/javascript', body: 'OLD_RENDERER' });
  const h = harness(pack); await h.message('enable'); h.setVersion('b'.repeat(64));
  assert.equal(await (await h.request('/admin/post/1/edit', true)).text(), 'NETWORK');
  assert.equal((await h.message('state')).state, null);
  assert.equal(await (await h.request('/offline/marked.js')).text(), 'NETWORK');
});
test('enable and version checks work with no AbortSignal.timeout global', async () => {
  // The VM intentionally exposes AbortController and timers, but no AbortSignal.
  const h = harness(makePack()); assert.equal((await h.message('enable')).ok, true);
  assert.ok((await h.message('check')).state);
});

 test('nested article paths are accepted and served offline', async () => {
  const pack = makePack(); pack.entries.push({path:'/post/notes/20260227/844880',type:'text/html',body:'NESTED'});
  const h = harness(pack); assert.equal((await h.message('enable')).ok,true); h.setOffline(true);
  assert.equal(await (await h.request('/post/notes/20260227/844880',true)).text(),'NESTED');
});
