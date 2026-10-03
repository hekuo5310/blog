const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const fs = require('node:fs');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');
const { webcrypto } = require('node:crypto');
let api;
before(async () => {
  const result = await build({ entryPoints: ['src/offline/archive.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.txt': 'text' } });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require, Response, Headers, TextEncoder, Uint8Array, ReadableStream, CompressionStream, crypto: webcrypto, btoa, URL, console });
  api = module.exports;
});
function context(id = 'deployment-one', body = '# Public\n![picture](/images/public.png)') {
  const imageReads = [];
  const published = { id: 1, slug: 'public-post', title: 'Public', body, published: 1, tags: '["Tag"]', created_at: '2026-10-01 00:00:00' };
  const c = { req: { url: 'https://blog.test/offline/archive' }, json: (value, status, headers) => Response.json(value, { status, headers }), env: {
    VERSION: { id }, SESSIONS: { async get() { return null; } },
    DB: { prepare(sql) { return { async all() {
      if (/FROM post_activities/.test(sql)) return { results: [] };
      if (/GROUP BY/.test(sql)) return { results: [{ tag: 'Tag', count: 1 }] };
      if (/FROM posts/.test(sql)) { assert.match(sql, /published=1/); return { results: [published] }; }
      if (/FROM pages/.test(sql)) { assert.match(sql, /published=1/); return { results: [] }; }
      throw Error(sql);
    } }; } },
    IMAGES: { async get(key) { imageReads.push(key); return { size: 3, httpMetadata: { contentType: 'image/png' }, async arrayBuffer() { return Uint8Array.from([1, 2, 3]).buffer; } }; } },
  } };
  return { c, imageReads };
}
test('gzip archive contains public pages, local rendering assets, pagination and only referenced images', async () => {
  const { c, imageReads } = context(); const response = await api.offlineArchive(c); assert.equal(response.status, 200);
  const pack = JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())));
  assert.deepEqual(imageReads, ['public.png']);
  for (const path of ['/', '/?page=1', '/chatgpt-stats', '/post/public-post', '/tags', '/tag/Tag', '/tag/Tag?page=1', '/archive', '/search', '/rss.xml', '/images/public.png', '/offline/marked.js', '/offline/purify.js']) assert.ok(pack.entries.some(e => e.path === path), path);
  assert.ok(pack.entries.every(e => !e.path.startsWith('/admin') && e.path !== '/stats'));
  const post = pack.entries.find(e => e.path === '/post/public-post').body;
  assert.match(post, /src="\/offline\/marked.js"/); assert.doesNotMatch(post, /giscus.app\/client.js|quill.snow.css/);
  assert.equal(pack.entries.find(e => e.path === '/images/public.png').body, 'AQID');
});
test('deployment and public content edits change the version', async () => {
  const one = await (await api.offlineVersion(context().c)).json();
  const repeat = await (await api.offlineVersion(context().c)).json(); assert.equal(one.version, repeat.version);
  const deploy = await (await api.offlineVersion(context('deployment-two').c)).json(); assert.notEqual(one.version, deploy.version);
  const edit = await (await api.offlineVersion(context('deployment-one', 'Updated text').c)).json(); assert.notEqual(one.version, edit.version);
});
test('oversized Base64 representation is rejected before image bytes are read', async () => {
  const { c } = context(); let read = false;
  c.env.IMAGES.get = async () => ({ size: 30 * 1024 * 1024, httpMetadata: { contentType: 'image/png' }, async arrayBuffer() { read = true; throw Error('must not read'); } });
  const response = await api.offlineArchive(c); assert.equal(response.status, 413); assert.equal(read, false);
});
test('chunked image Base64 preserves bytes across chunk and padding boundaries', async () => {
  const { c } = context(); const image = Uint8Array.from({ length: 16385 }, (_, i) => i % 256);
  c.env.IMAGES.get = async () => ({ size: image.length, httpMetadata: { contentType: 'image/png' }, async arrayBuffer() { return image.buffer; } });
  const pack = JSON.parse(gunzipSync(Buffer.from(await (await api.offlineArchive(c)).arrayBuffer())));
  assert.equal(pack.entries.find(e => e.path === '/images/public.png').body, Buffer.from(image).toString('base64'));
});
