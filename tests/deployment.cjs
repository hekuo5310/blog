// Check Wrangler's real output, including its text-module imports. A source-only
// esbuild test cannot detect Wrangler accidentally executing browser scripts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { build } = require('esbuild');
const { webcrypto } = require('node:crypto');
(async () => {
  const entry = '.wrangler/offline-check/index.js';
  const output = fs.readFileSync(entry, 'utf8');
  assert.match(output, /import .* from .*sw\.js\.txt/);
  assert.match(output, /import .* from .*client\.js\.txt/);
  assert.doesNotMatch(output, /self\.location\.origin|document\.getElementById\(['"]offline-toggle/);
  const bundle = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.txt': 'text' } });
  const module = { exports: {} };
  // Browser globals are deliberately absent, matching server startup.
  vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, require, Response, Request, Headers, URL, TextEncoder, Uint8Array, crypto: webcrypto, console });
  const app = module.exports.default;
  for (const [path, marker] of [['sw.js', 'self.location.origin'], ['client.js', 'offline-toggle'], ['marked.js', 'marked'], ['purify.js', 'DOMPurify']]) {
    const response = await app.fetch(new Request('https://blog.test/offline/' + path), {}, { waitUntil() {} });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Content-Type'), /text\/javascript/);
    assert.ok((await response.text()).includes(marker), path);
  }
  console.log('Wrangler output: server startup and all four browser asset routes passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
