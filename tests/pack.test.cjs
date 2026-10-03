const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const vm = require('node:vm');
let ArchivePack;
before(async () => {
  const result = await build({ entryPoints: ['src/offline/pack.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, TextEncoder, ReadableStream });
  ArchivePack = module.exports.ArchivePack;
});
test('size accounting equals streamed UTF-8 JSON including escaping, commas and multibyte text', async () => {
  const entries = [{ path: '/', type: 'text/html', body: '中文\n"\\\u0001😀\ud800\udc00\udc00\ud800'  }, { path: '/images/test', type: 'image/png', body: 'AQIDBA==', base64: true }];
  const expected = JSON.stringify({ version: 'test', entries });
  const exact = Buffer.byteLength(expected);
  const pack = new ArchivePack('test', exact);
  for (const entry of entries) pack.add(entry);
  assert.equal(pack.bytes, exact); assert.equal(await new Response(pack.stream()).text(), expected);
  const tooSmall = new ArchivePack('test', exact - 1);
  tooSmall.add(entries[0]); assert.throws(() => tooSmall.add(entries[1]), /32 MiB/);
});
test('raw text that fits still fails when JSON escaping exceeds the limit', () => {
  const body = '\u0001'.repeat(100);
  const pack = new ArchivePack('test', 300);
  assert.ok(Buffer.byteLength(body) < 300);
  assert.throws(() => pack.add({ path: '/', type: 'text/html', body }), /32 MiB/);
});
test('image capacity includes Base64 padding and entry metadata', () => {
  const entry = { path: '/images/a', type: 'image/png', body: 'AQ==', base64: true };
  const limit = Buffer.byteLength(JSON.stringify({ version: 'test', entries: [entry] }));
  const pack = new ArchivePack('test', limit); pack.checkImage(entry.path, entry.type, 1); pack.add(entry);
  const small = new ArchivePack('test', limit - 1); assert.throws(() => small.checkImage(entry.path, entry.type, 1), /32 MiB/);
});
