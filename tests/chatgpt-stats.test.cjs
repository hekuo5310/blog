const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
let app, auth;
const sample = () => ({ totalTokens: 1415463545, peakDailyTokens: 125716880, longestTaskSeconds: 80080, longestStreakDays: 14, currentStreakDays: 0,
  daily: [{ start_date: '2026-09-30', tokens: 53256440, chat_turns: 0 }], weekly: [{ start_date: '2026-09-28', tokens: 97597082, chat_turns: 0 }], cumulative: [{ start_date: '2026-09-30', tokens: 1415463545, chat_turns: 0 }] });
before(async () => {
  async function load(entry) {
    const bundle = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.txt': 'text' } });
    const module = { exports: {} };
    vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require, Request, Response, Headers, URL, TextEncoder, TextDecoder, Uint8Array, ReadableStream, CompressionStream, crypto: webcrypto,
      console: { error() { throw Error('Unexpected server error logging'); }, log() { throw Error('Unexpected logging'); } }, fetch() { throw Error('Backend must not access ChatGPT or any network'); } });
    return module.exports;
  }
  app = (await load('src/index.ts')).default; auth = await load('src/auth.ts');
});
function fixture() {
  const map = new Map(); const reads = []; const writes = [];
  const kv = { async get(key) { reads.push(key); return map.get(key) ?? null; }, async put(key, value) { writes.push([key, value]); map.set(key, value); } };
  const env = { SYNC_TOKEN: 'test-sync-token-only', CHATGPT_STATS: kv, SESSIONS: kv, DB: { prepare() { throw Error('Stats API must not access D1'); } } };
  const send = (payload, authorization = 'Bearer test-sync-token-only', headers = {}) => app.fetch(new Request('https://blog.test/api/chatgpt-stats/update', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authorization, ...headers }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) }), env, { waitUntil() {} });
  const get = () => app.fetch(new Request('https://blog.test/api/chatgpt-stats'), env, { waitUntil() {} });
  return { map, reads, writes, env, send, get };
}
test('existing UserScript payload stores only the fixed fields and server ISO timestamp, then public GET returns it', async () => {
  const f = fixture(); const payload = sample();
  const before = Date.now(); const response = await f.send(payload); assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0][0], 'profile');
  const stored = JSON.parse(f.writes[0][1]);
  assert.deepEqual(Object.keys(stored).sort(), [...Object.keys(payload), 'updatedAt'].sort());
  assert.match(stored.updatedAt, /^\d{4}-\d{2}-\d{2}T.*\.\d{3}Z$/); assert.ok(Date.parse(stored.updatedAt) >= before);
  for (const key of Object.keys(payload)) assert.deepEqual(stored[key], payload[key]);
  const get = await f.get(); assert.equal(get.status, 200); assert.equal(get.headers.get('Cache-Control'), 'public, max-age=300');
  assert.equal(get.headers.get('Access-Control-Allow-Origin'), null); assert.deepEqual(await get.json(), stored);
});
test('missing/wrong authorization returns 401 and never reads or writes KV', async () => {
  for (const token of ['', 'Bearer wrong', 'Basic test-sync-token-only']) {
    const f = fixture(); assert.equal((await f.send(sample(), token)).status, 401); assert.equal(f.reads.length + f.writes.length, 0);
  }
});
test('missing configuration fails closed, no data returns null and storage failures stay generic', async () => {
  const f = fixture(); assert.equal(await (await f.get()).json(), null);
  delete f.env.SYNC_TOKEN; assert.equal((await f.send(sample())).status, 503);
  f.env.SYNC_TOKEN = 'test-sync-token-only'; delete f.env.CHATGPT_STATS; assert.equal((await f.get()).status, 503); assert.equal((await f.send(sample())).status, 503);
  const broken = fixture(); broken.env.CHATGPT_STATS.put = async () => { throw Error('private provider diagnostic'); };
  const response = await broken.send(sample()); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private provider diagnostic/);
});
test('invalid scalars, arrays, JSON, and content types return 400 without storing', async () => {
  const variants = [];
  for (const key of ['totalTokens', 'peakDailyTokens', 'longestTaskSeconds', 'longestStreakDays', 'currentStreakDays']) {
    for (const value of [-1, '0', null, true]) variants.push({ ...sample(), [key]: value });
    const absent = sample(); delete absent[key]; variants.push(absent);
  }
  for (const key of ['daily', 'weekly', 'cumulative']) variants.push({ ...sample(), [key]: {} });
  variants.push('[]', '{broken', JSON.stringify(sample()).replace('1415463545', '1e400'));
  for (const payload of variants) { const f = fixture(); assert.equal((await f.send(payload)).status, 400); assert.equal(f.writes.length, 0); }
  assert.equal((await fixture().send(sample(), undefined, { 'Content-Type': 'text/plain' })).status, 400);
});
test('private/unknown fields, nested metadata, invalid dates and duplicate dates cannot enter public KV', async () => {
  const variants = [{ ...sample(), cookie: 'not-a-real-cookie' }, { ...sample(), updatedAt: 'forged' },
    { ...sample(), daily: [{ start_date: '2026-09-30', tokens: 1, account_id: 'not-a-real-id' }] },
    { ...sample(), daily: [{ start_date: '2026-02-30', tokens: 1 }] }, { ...sample(), daily: [{ start_date: '2026-09-30', tokens: -1 }] },
    { ...sample(), daily: [{ start_date: '2026-09-30', tokens: 1, chat_turns: 'content' }] },
    { ...sample(), daily: [sample().daily[0], sample().daily[0]] }];
  for (const payload of variants) { const f = fixture(); assert.equal((await f.send(payload)).status, 400); assert.equal(f.writes.length, 0); }
  const f = fixture(); f.map.set('profile', JSON.stringify({ ...sample(), updatedAt: new Date().toISOString(), authorization: 'private' }));
  const response = await f.get(); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /authorization|private/);
});
test('zero scalar values and empty graphs are valid', async () => {
  const f = fixture(); const payload = sample();
  for (const key of Object.keys(payload)) payload[key] = Array.isArray(payload[key]) ? [] : 0;
  assert.equal((await f.send(payload)).status, 200);
});
test('request limit rejects declared and actual oversized payloads even without Content-Length', async () => {
  const f = fixture(); assert.equal((await f.send(sample(), undefined, { 'Content-Length': '262145' })).status, 413);
  assert.equal((await f.send(' '.repeat(262145))).status, 413); assert.equal(f.writes.length, 0);
});
test('shared namespace profile key cannot authenticate as a session; real session still works', async () => {
  const f = fixture(); await f.send(sample());
  const context = token => ({ req: { method: 'GET', url: 'https://blog.test/admin', raw: new Request('https://blog.test/admin', { headers: { Cookie: '__Host-session=' + token } }), header(name) { return name === 'Cookie' ? '__Host-session=' + token : undefined; } }, env: f.env });
  assert.equal(await auth.validateSession(context('profile')), false);
  const token = 'a'.repeat(64); f.map.set(token, '1'); assert.equal(await auth.validateSession(context(token)), true);
  f.map.set(token, f.map.get('profile')); assert.equal(await auth.validateSession(context(token)), false);
});

test('dedicated statistics page uses the blog layout and does not require a sync token', async () => {
  const f = fixture(); delete f.env.SYNC_TOKEN;
  const response = await app.fetch(new Request('https://blog.test/chatgpt-stats', { headers: { DNT: '1' } }), f.env, { waitUntil() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ChatGPT Token 统计/); assert.match(html, /id="chatgpt-stats"/); assert.match(html, /href="\/chatgpt-stats"/);
});
