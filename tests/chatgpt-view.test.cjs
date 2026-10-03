const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { build } = require('esbuild');
const fs = require('node:fs');
const vm = require('node:vm');
let html;
const script = fs.readFileSync('src/chatgpt-stats-client.js.txt', 'utf8');
const now = Date.parse('2026-10-03T10:30:00.000Z');
const payload = () => ({ totalTokens: 1415463545, peakDailyTokens: 125716880, longestTaskSeconds: 80080, longestStreakDays: 14, currentStreakDays: 0, updatedAt: '2026-10-03T10:27:00.000Z',
  daily: [{ start_date: '2026-09-30', tokens: 100, chat_turns: 0 }, { start_date: '2026-09-29', tokens: 25, chat_turns: 0 }, { start_date: '2024-02-29', tokens: 50, chat_turns: 0 }], weekly: [],
  cumulative: [{ start_date: '2026-09-30', tokens: 1415463545, chat_turns: 0 }, { start_date: '2026-09-29', tokens: 1362207105, chat_turns: 0 }] });
before(async () => {
  const bundle = await build({ entryPoints: ['src/html.ts'], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.txt': 'text' } });
  const module = { exports: {} }; vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require }); html = module.exports;
});
async function waitFor(check) {
  const deadline = Date.now() + 2000;
  while (!check()) { if (Date.now() > deadline) throw Error('DOM update timed out'); await new Promise(r => setImmediate(r)); }
}
function page(t, fetcher) {
  const dom = new JSDOM(html.chatgptStatsPage(), { url: 'https://blog.test/chatgpt-stats', runScripts: 'outside-only' });
  const w = dom.window; w.Date.now = () => now;
  w.fetch = fetcher; const calls = [];
  const actual = w.fetch; w.fetch = (...args) => { calls.push(args); return actual(...args); };
  t.after(() => w.close()); w.eval(script);
  return { w, d: w.document, calls };
}
const value = (d, key) => d.querySelector('[data-chatgpt-field="' + key + '"]').textContent;
test('dedicated page shows skeleton, expected token/duration/relative formats, daily hover and a cumulative SVG', async t => {
  let resolve; const response = new Promise(r => resolve = r); const { d, w, calls } = page(t, () => response);
  assert.ok(d.querySelector('.chatgpt-loading')); assert.equal(d.getElementById('chatgpt-stats').getAttribute('aria-busy'), 'true');
  resolve(Response.json(payload())); await waitFor(() => d.getElementById('chatgpt-stats').getAttribute('aria-busy') === 'false');
  assert.equal(value(d, 'totalTokens'), '1.42B'); assert.match(d.querySelector('[data-chatgpt-detail="totalTokens"]').textContent, /14.15 亿/);
  assert.equal(value(d, 'peakDailyTokens'), '125.72M'); assert.equal(value(d, 'longestTaskSeconds'), '22h 14m 40s');
  assert.equal(value(d, 'longestStreakDays'), '14 天'); assert.equal(value(d, 'currentStreakDays'), '0 天'); assert.equal(value(d, 'updatedAt'), '3 分钟前');
  assert.equal(d.querySelectorAll('#chatgpt-heatmap [data-date]').length, 365);
  const cell = d.querySelector('#chatgpt-heatmap [data-date="2026-09-30"]'); assert.equal(cell.dataset.l, '4'); assert.match(cell.title, /2026-09-30 · 100 Tokens/);
  assert.equal(d.querySelector('#chatgpt-heatmap [data-date="2026-09-29"]').dataset.l, '1');
  cell.dispatchEvent(new w.Event('click')); assert.equal(d.getElementById('chatgpt-selected').textContent, cell.title);
  const year = d.getElementById('chatgpt-year'); year.value = '2024'; year.dispatchEvent(new w.Event('change'));
  assert.equal(d.querySelectorAll('#chatgpt-heatmap [data-date]').length, 366); assert.ok(d.querySelector('[data-date="2024-02-29"]'));
  const curve = d.querySelector('.chatgpt-curve'); assert.ok(curve); assert.equal(curve.getAttribute('viewBox'), '0 0 720 195'); assert.equal(curve.querySelectorAll('circle').length, 2);
  assert.doesNotMatch(curve.querySelector('polyline').getAttribute('points'), /NaN|Infinity/);
  assert.equal(calls[0][0], '/api/chatgpt-stats'); assert.equal(calls[0][1].credentials, 'omit');
});
test('old data displays the specified stale warning; zeros and empty series render without a graph', async t => {
  const data = payload(); data.updatedAt = '2026-10-01T10:30:00.000Z'; data.totalTokens = 0; data.daily = []; data.cumulative = [];
  const { d } = page(t, async () => Response.json(data)); await waitFor(() => d.getElementById('chatgpt-stats').getAttribute('aria-busy') === 'false');
  assert.equal(d.getElementById('chatgpt-status').textContent, '统计数据可能尚未同步'); assert.equal(value(d, 'totalTokens'), '0');
  assert.equal(d.getElementById('chatgpt-heatmap-wrap').hidden, true); assert.equal(d.getElementById('chatgpt-curve-wrap').hidden, true);
});
test('empty KV gives the specified no-data message', async t => {
  const { d } = page(t, async () => Response.json(null)); await waitFor(() => d.getElementById('chatgpt-stats').getAttribute('aria-busy') === 'false');
  assert.equal(d.getElementById('chatgpt-status').textContent, '暂无 ChatGPT 使用统计'); assert.equal(d.getElementById('chatgpt-content').hidden, true);
});
test('API errors stay within the card and retry restores the stats', async t => {
  let error = true;
  const { d, w } = page(t, async () => error ? new Response('Unavailable', { status: 503 }) : Response.json(payload()));
  await waitFor(() => d.getElementById('chatgpt-stats').getAttribute('aria-busy') === 'false');
  assert.match(d.getElementById('chatgpt-status').textContent, /暂时无法加载/); assert.equal(d.getElementById('chatgpt-retry').hidden, false);
  error = false; d.getElementById('chatgpt-retry').dispatchEvent(new w.Event('click'));
  await waitFor(() => value(d, 'totalTokens') === '1.42B'); assert.equal(d.getElementById('chatgpt-content').hidden, false);
});
test('component reuses theme variables, constrains scroll to its container and is separate from the homepage', () => {
  const first = html.chatgptStatsPage(); assert.match(first, /id="chatgpt-stats"/);
  assert.doesNotMatch(html.postList([], []), /id="chatgpt-stats"/);
  assert.match(html.postList([], []), /href="\/chatgpt-stats">Token 统计/);
  assert.doesNotMatch(html.postList([], [], undefined, 2, 2), /id="chatgpt-stats"/);
  assert.match(first, /chatgpt-grid-scroll\{overflow-x:auto;max-width:100%/);
  assert.match(first, /chatgpt-stats\{[^}]*var\(--surface\)/);
  assert.match(first, /@media\(max-width:600px\)\{\.chatgpt-stats/);
});
