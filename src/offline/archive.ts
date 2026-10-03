import { ArchivePack, ArchiveSizeError } from './pack'
import type { Context } from 'hono'
import type { Env } from '../index'
import { listPublicPosts, listPublicPostActivities, listPublicTags } from '../posts'
import { listPublicPages } from '../pages'
import { extractImageKeys } from '../images'
import { DEFAULT_CONFIG, postList, postDetail, pageDetail, archivePage, searchPage, tagsPage, tagPostsPage, termsPage, privacyPage, chatgptStatsPage } from '../html'
import { databaseUtcToIso } from '../time'
import type { SiteConfig } from '../html'
import marked from './marked.umd.js.txt'
import purify from './purify.min.js.txt'
import client from './client.js.txt'
import worker from './sw.js.txt'

export const assets: Record<string, string> = {
  '/offline/marked.js': marked, '/offline/purify.js': purify, '/offline/client.js': client,
}
async function snapshot(c: Context<{ Bindings: Env }>) {
  const [posts, pages, activities, tags, raw] = await Promise.all([
    listPublicPosts(c), listPublicPages(c), listPublicPostActivities(c), listPublicTags(c), c.env.SESSIONS.get('site:config'),
  ])
  let cfg: SiteConfig = DEFAULT_CONFIG
  try { if (raw) cfg = JSON.parse(raw) } catch {}
  const data = { posts, pages, activities, tags, cfg }
  // Workers supplies a new ID on every deployment; content edits also invalidate snapshots.
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([c.env.VERSION?.id || 'local', data])))
  const version = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
  return { ...data, version }
}
export async function offlineVersion(c: Context<{ Bindings: Env }>) {
  return c.json({ version: (await snapshot(c)).version }, 200, { 'Cache-Control': 'no-store' })
}
export function offlineAsset(c: Context<{ Bindings: Env }>) {
  const text = c.req.path === '/offline/sw.js' ? worker : assets[c.req.path]
  if (!text) return c.notFound()
  return c.body(text, 200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' })
}
export async function offlineArchive(c: Context<{ Bindings: Env }>) {
  try { return await buildArchive(c) }
  catch (error) {
    if (error instanceof ArchiveSizeError) return c.json({ error: error.message }, 413)
    throw error
  }
}
async function buildArchive(c: Context<{ Bindings: Env }>) {
  const s = await snapshot(c)
  const pack = new ArchivePack(s.version)
  const add = (path: string, body: string, type = 'text/html; charset=utf-8') => pack.add({ path, type, body })
  const total = Math.max(1, Math.ceil(s.posts.length / 10))
  for (let page = 1; page <= total; page++) {
    const html = postList(s.posts.slice((page - 1) * 10, page * 10), s.activities, s.cfg, page, total)
    add('/?page=' + page, html)
    if (page === 1) add('/', html)
  }
  for (const post of s.posts) add('/post/' + encodeURIComponent(post.slug), postDetail(post, s.cfg, null))
  for (const page of s.pages) add('/p/' + encodeURIComponent(page.slug), pageDetail(page, s.cfg))
  add('/chatgpt-stats', chatgptStatsPage(s.cfg))
  add('/archive', archivePage(s.posts, s.cfg))
  add('/search', searchPage('', [], s.cfg))
  // Pre-render search results so arbitrary queries work without a server or remote scripts.
  add('/offline/search.json', JSON.stringify(s.posts.map(p => ({ title: p.title, body: p.body, html: searchPage('', [p], s.cfg).match(/<article class="post-item">[\s\S]*?<\/article>/)?.[0] || '' }))), 'application/json')
  add('/tags', tagsPage(s.tags, s.cfg))
  for (const { tag } of s.tags) {
    const posts = s.posts.filter(p => { try { return JSON.parse(p.tags || '[]').includes(tag) } catch { return false } })
    const totalPages = Math.ceil(posts.length / 20)
    for (let page = 1; page <= totalPages; page++) {
      const path = '/tag/' + encodeURIComponent(tag)
      const html = tagPostsPage(tag, posts.slice((page - 1) * 20, page * 20), posts.length, page, totalPages, s.cfg)
      add(path + '?page=' + page, html)
      if (page === 1) add(path, html)
    }
  }
  add('/updates.json', JSON.stringify(s.posts.map(p => ({ title: p.title, url: '/post/' + encodeURIComponent(p.slug), createdAt: databaseUtcToIso(p.created_at) }))), 'application/json')
  const xml = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)
  const origin = new URL(c.req.url).origin
  const rss = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>' + xml(s.cfg.title) + '</title><link>' + xml(origin) + '</link>' + s.posts.map(p => '<item><title>' + xml(p.title) + '</title><link>' + xml(origin + '/post/' + encodeURIComponent(p.slug)) + '</link><pubDate>' + new Date(databaseUtcToIso(p.created_at)).toUTCString() + '</pubDate></item>').join('') + '</channel></rss>'
  add('/rss.xml', rss, 'application/rss+xml'); add('/feed.xml', rss, 'application/rss+xml')
  add('/terms', termsPage(s.cfg)); add('/privacy', privacyPage(s.cfg))
  for (const [path, body] of Object.entries(assets)) add(path, body, 'text/javascript; charset=utf-8')
  const keys = new Set([...s.posts, ...s.pages].flatMap(p => extractImageKeys(p.body)))
  // Keep archive generation below the Worker memory limit; never silently enable a partial snapshot.
  for (const key of keys) {
    if (key.includes('..')) continue
    const image = await c.env.IMAGES.get(key)
    if (!image) continue
    const path = '/images/' + key
    const type = image.httpMetadata?.contentType || 'application/octet-stream'
    pack.checkImage(path, type, image.size)
    const data = new Uint8Array(await image.arrayBuffer())
    const chunks: string[] = []
    // Chunk size is divisible by 3, so intermediate Base64 chunks have no padding.
    for (let i = 0; i < data.length; i += 8190) chunks.push(btoa(String.fromCharCode(...data.subarray(i, i + 8190))))
    pack.add({ path, type, body: chunks.join(''), base64: true })
  }
  const stream = pack.stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream, { headers: { 'Content-Type': 'application/gzip', 'Cache-Control': 'no-store', 'Content-Disposition': 'attachment; filename="blog-offline.json.gz"' } })
}
