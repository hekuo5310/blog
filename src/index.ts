import { Hono } from 'hono'
import type { Context } from 'hono'
import { postList, postDetail, loginPage, adminDashboard, postForm, adminPageDashboard, pageDetail, pageForm, settingsPage, termsPage, privacyPage, statsPage, searchPage, archivePage, DEFAULT_CONFIG } from './html'
import type { GiscusConfig, SiteConfig, Post } from './html'
import { listPages, listPublicPages, getPageBySlug, getPageById, createPage, updatePage, deletePage, togglePagePublish } from './pages'
import { createSession, validateSession, deleteSession, sessionCookie, clearCookie, isLoginRateLimited, recordLoginFailure, clearLoginFailures } from './auth'
import { listPublicPosts, listPublicPostActivities, getPublishedPostBySlug, getPostById, adminListPosts, createPost, updatePost, deletePost, togglePublish, searchPublicPosts, normalizeTags, listTags } from './posts'
import { deleteImageKeys, deleteRemovedImages, extractImageKeys, serveImage, uploadImage } from './images'
import { extractAiSummaryBlocks, blocksEqual, parseSummaries, generateSummaries, polishParagraphs } from './ai-summary'
import { normalizeArticleLicenseInput } from './licenses'
import { databaseUtcToIso, parseDatabaseUtc } from './time'
import { getPublicStats, recordPageView, shouldRecordPageView } from './analytics'
import { isConfigured } from './config'

export type Env = {
  DB: D1Database
  SESSIONS: KVNamespace
  IMAGES: R2Bucket
  ADMIN_USER: string
  ADMIN_PASS: string
  OPENAI_API_KEY: string
  OPENAI_BASE_URL?: string
  OPENAI_MODEL?: string
  GISCUS_REPO?: string
  GISCUS_REPO_ID?: string
  GISCUS_CATEGORY?: string
  GISCUS_CATEGORY_ID?: string
  GISCUS_MAPPING?: string
  GISCUS_LANG?: string
}

const app = new Hono<{ Bindings: Env }>()

let tagMigration: Promise<void> | null = null
async function ensureTagMigration(env: Env): Promise<void> {
  if (!tagMigration) {
    tagMigration = (async () => {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))" ).run()
      const applied = await env.DB.prepare('SELECT 1 FROM schema_migrations WHERE name=?').bind('0011_post_tags').first()
      if (applied) return
      const columns = await env.DB.prepare('PRAGMA table_info(posts)').all<{ name: string }>()
      if (!columns.results.some(column => column.name === 'tags')) {
        await env.DB.prepare("ALTER TABLE posts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'").run()
      }
      await env.DB.prepare('INSERT OR IGNORE INTO schema_migrations (name) VALUES (?)').bind('0011_post_tags').run()
    })().catch(error => { tagMigration = null; throw error })
  }
  return tagMigration
}

function usesSecureCookies(c: Context): boolean {
  return new URL(c.req.url).protocol === 'https:'
}

app.use('*', async (c, next) => {
  await ensureTagMigration(c.env)
  await next()
})

app.use('*', async (c, next) => {
  await next()
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'SAMEORIGIN')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
})

app.use('*', async (c, next) => {
  await next()
  if (shouldRecordPageView(c)) {
    c.executionCtx.waitUntil(recordPageView(c).catch(error => console.error('page view recording failed', error)))
  }
})

async function getConfig(env: Env): Promise<SiteConfig> {
  const raw = await env.SESSIONS.get('site:config')
  if (!raw) return DEFAULT_CONFIG
  try { return JSON.parse(raw) } catch { return DEFAULT_CONFIG }
}

function getGiscusConfig(env: Env): GiscusConfig | null {
  if (!isConfigured(env.GISCUS_REPO_ID) || !isConfigured(env.GISCUS_CATEGORY) || !isConfigured(env.GISCUS_CATEGORY_ID)) return null
  return {
    repo: isConfigured(env.GISCUS_REPO) ? env.GISCUS_REPO! : 'hekuo5310/blog',
    repoId: env.GISCUS_REPO_ID!,
    category: env.GISCUS_CATEGORY!,
    categoryId: env.GISCUS_CATEGORY_ID!,
    mapping: isConfigured(env.GISCUS_MAPPING) ? env.GISCUS_MAPPING! : 'pathname',
    strict: '0',
    reactionsEnabled: '1',
    emitMetadata: '0',
    inputPosition: 'bottom',
    lang: isConfigured(env.GISCUS_LANG) ? env.GISCUS_LANG! : 'zh-CN'
  }
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function rssDate(value: string): string {
  const date = parseDatabaseUtc(value)
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString()
}

function rssDescription(body: string): string {
  return body
    .replace(/\[ai-summary\][\s\S]*?\[\/ai-summary\]/gi, '')
    .replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi, '$1')
    .replace(/\^\[([^\]]+)\]/g, '$1')
    .replace(/[#*_`>\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

async function rssFeed(c: Context<{ Bindings: Env }>) {
  const posts = await listPublicPosts(c)
  const origin = new URL(c.req.url).origin
  const title = (await getConfig(c.env)).title
  const items = posts.map((post: Post) => {
    const url = `${origin}/post/${encodeURIComponent(post.slug)}`
    return `<item><title>${xmlEscape(post.title)}</title><link>${xmlEscape(url)}</link><guid isPermaLink="true">${xmlEscape(url)}</guid><description>${xmlEscape(rssDescription(post.body))}</description><pubDate>${rssDate(post.created_at)}</pubDate></item>`
  }).join('')
  const feed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xmlEscape(title)}</title><link>${xmlEscape(origin)}</link><description>${xmlEscape(title)} RSS 订阅</description><language>zh-CN</language>${items}</channel></rss>`
  return new Response(feed, { headers: { 'Content-Type': 'application/rss+xml; charset=UTF-8', 'Cache-Control': 'public, max-age=300' } })
}

app.use('/admin/*', async (c, next) => {
  if (c.req.path === '/admin/login') return next()
  if (!await validateSession(c)) return c.redirect('/admin/login')
  return next()
})

// public
app.get('/images/*', serveImage)

app.get('/', async (c) => {
  const [posts, activities, cfg] = await Promise.all([listPublicPosts(c), listPublicPostActivities(c), getConfig(c.env)])
  return c.html(postList(posts, activities, cfg))
})

app.get('/updates.json', async (c) => {
  const posts = await listPublicPosts(c)
  return c.json(posts.map(p => ({ title: p.title, url: `/post/${encodeURIComponent(p.slug)}`, createdAt: databaseUtcToIso(p.created_at) })))
})

app.get('/rss.xml', rssFeed)
app.get('/feed.xml', rssFeed)

app.get('/robots.txt', (c) => {
  const origin = new URL(c.req.url).origin
  return c.text(`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${origin}/sitemap.xml\n`, 200, { 'Cache-Control': 'public, max-age=86400' })
})

app.get('/sitemap.xml', async (c) => {
  const [posts, pages] = await Promise.all([listPublicPosts(c), listPublicPages(c)])
  const origin = new URL(c.req.url).origin
  const urls = [
    { path: '/', lastmod: undefined },
    ...posts.map(post => ({ path: `/post/${encodeURIComponent(post.slug)}`, lastmod: databaseUtcToIso(post.created_at).slice(0, 10) })),
    ...pages.map(page => ({ path: `/p/${encodeURIComponent(page.slug)}`, lastmod: databaseUtcToIso(page.created_at).slice(0, 10) }))
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(item => `<url><loc>${xmlEscape(`${origin}${item.path}`)}</loc>${item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : ''}</url>`).join('')}</urlset>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=UTF-8', 'Cache-Control': 'public, max-age=3600' } })
})

app.get('/healthz', async (c) => {
  await c.env.DB.prepare('SELECT 1').first()
  c.header('Cache-Control', 'no-store')
  return c.json({ ok: true })
})

app.get('/stats', async (c) => {
  const [report, cfg] = await Promise.all([getPublicStats(c, c.req.query('range')), getConfig(c.env)])
  c.header('Cache-Control', 'no-store')
  return c.html(statsPage(report, cfg))
})

app.get('/stats.json', async (c) => {
  c.header('Cache-Control', 'no-store')
  return c.json(await getPublicStats(c, c.req.query('range')))
})

app.get('/search', async (c) => {
  const query = (c.req.query('q') || '').trim()
  const [posts, cfg] = await Promise.all([searchPublicPosts(c, query), getConfig(c.env)])
  return c.html(searchPage(query, posts, cfg))
})
app.get('/archive', async (c) => {
  const [posts, cfg] = await Promise.all([listPublicPosts(c), getConfig(c.env)])
  return c.html(archivePage(posts, cfg))
})

app.get('/post/:slug', async (c) => {
  const post = await getPublishedPostBySlug(c, c.req.param('slug'))
  if (!post) return c.notFound()
  const cfg = await getConfig(c.env)
  return c.html(postDetail(post, cfg, getGiscusConfig(c.env)))
})

app.get('/terms', async (c) => {
  return c.html(termsPage(await getConfig(c.env)))
})

app.get('/privacy', async (c) => {
  return c.html(privacyPage(await getConfig(c.env)))
})

// admin auth
app.get('/admin/login', (c) => c.html(loginPage()))
app.post('/admin/login', async (c) => {
  if (await isLoginRateLimited(c)) {
    return c.html(loginPage('登录尝试过多，请在 15 分钟后重试'), 429, { 'Retry-After': '900' })
  }
  const form = await c.req.formData()
  const username = form.get('username') as string
  const password = form.get('password') as string
  if (username !== c.env.ADMIN_USER || password !== c.env.ADMIN_PASS) {
    await recordLoginFailure(c)
    return c.html(loginPage('用户名或密码错误'), 401)
  }
  await clearLoginFailures(c)
  const token = await createSession(c.env)
  return new Response(null, { status: 302, headers: { Location: '/admin', 'Set-Cookie': sessionCookie(token, usesSecureCookies(c)) } })
})

app.post('/admin/logout', async (c) => {
  await deleteSession(c)
  return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': clearCookie(usesSecureCookies(c)) } })
})

// admin settings
app.get('/admin/settings', async (c) => {
  const cfg = await getConfig(c.env)
  return c.html(settingsPage(cfg))
})

app.post('/admin/settings', async (c) => {
  const form = await c.req.formData()
  const title = (form.get('title') as string ?? '').trim() || DEFAULT_CONFIG.title
  const desc = (form.get('desc') as string ?? '').trim()
  const navRaw = (form.get('navLinks') as string ?? '').trim()
  const navLinks = navRaw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const idx = l.indexOf('|')
    return idx > 0 ? { label: l.slice(0, idx).trim(), url: l.slice(idx + 1).trim() } : null
  }).filter(Boolean) as SiteConfig['navLinks']
  const cfg: SiteConfig = { title, desc, navLinks }
  await c.env.SESSIONS.put('site:config', JSON.stringify(cfg))
  return c.html(settingsPage(cfg, true))
})

app.post('/admin/images', uploadImage)
app.post('/admin/polish', async (c) => { const body = await c.req.json<{ paragraphs?: string[] }>(); const paragraphs = (body.paragraphs || []).filter(p => typeof p === 'string').slice(0, 50); return c.json({ paragraphs: await polishParagraphs(c.env, paragraphs) }) })
app.get('/admin/tags.json', async (c) => c.json(await listTags(c)))

// admin posts
app.get('/admin', async (c) => {
  const posts = await adminListPosts(c)
  return c.html(adminDashboard(posts))
})

app.get('/admin/post/new', (c) => c.html(postForm()))
app.post('/admin/post', async (c) => {
  const form = await c.req.formData()
  const title = (form.get('title') as string ?? '').trim().slice(0, 200)
  const slug = (form.get('slug') as string ?? '').trim()
  const body = (form.get('body') as string ?? '').replace(/\r\n/g,'\n').trim().slice(0, 200000)
  const license = normalizeArticleLicenseInput(form.get('license'), form.get('custom_license_name'), form.get('custom_license_text'))
  if (!title || !body) return c.redirect('/admin/post/new')
  const blocks = extractAiSummaryBlocks(body)
  const summaries = blocks.length ? await generateSummaries(c.env, blocks) : []
  await createPost(c, title, slug, body, JSON.stringify(summaries), license, normalizeTags((form.get('tags') as string ?? '')))
  return c.redirect('/admin')
})

app.get('/admin/post/:id/edit', async (c) => {
  const post = await getPostById(c, Number(c.req.param('id')))
  if (!post) return c.notFound()
  return c.html(postForm(post))
})

app.post('/admin/post/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const existing = await getPostById(c, id)
  if (!existing) return c.notFound()
  const form = await c.req.formData()
  const title = (form.get('title') as string ?? '').trim().slice(0, 200)
  const slug = (form.get('slug') as string ?? '').trim()
  const body = (form.get('body') as string ?? '').replace(/\r\n/g,'\n').trim().slice(0, 200000)
  const license = normalizeArticleLicenseInput(form.get('license'), form.get('custom_license_name'), form.get('custom_license_text'))
  if (!title || !body) return c.redirect(`/admin/post/${c.req.param('id')}/edit`)
  const newBlocks = extractAiSummaryBlocks(body)
  let summaries: string[] = []
  if (newBlocks.length) {
    const oldBlocks = extractAiSummaryBlocks(existing.body)
    const existingSummaries = parseSummaries(existing.ai_summary)
    if (blocksEqual(newBlocks, oldBlocks) && existingSummaries.length === newBlocks.length) {
      summaries = existingSummaries
    } else {
      summaries = await generateSummaries(c.env, newBlocks)
    }
  }
  await updatePost(c, existing, title, slug, body, newBlocks.length ? JSON.stringify(summaries) : null, license, normalizeTags((form.get('tags') as string ?? '')))
  await deleteRemovedImages(c.env, existing.body, body)
  return c.redirect('/admin')
})

app.post('/admin/post/:id/delete', async (c) => {
  const id = Number(c.req.param('id'))
  const post = await getPostById(c, id)
  await deletePost(c, id)
  if (post) await deleteImageKeys(c.env, extractImageKeys(post.body))
  return c.redirect('/admin')
})

app.post('/admin/post/:id/publish', async (c) => {
  await togglePublish(c, Number(c.req.param('id')))
  return c.redirect('/admin')
})

// public pages
app.get('/p/:slug', async (c) => {
  const page = await getPageBySlug(c, c.req.param('slug'))
  if (!page) return c.notFound()
  return c.html(pageDetail(page, await getConfig(c.env)))
})

// admin pages
app.get('/admin/pages', async (c) => {
  const pages = await listPages(c)
  return c.html(adminPageDashboard(pages))
})

app.get('/admin/page/new', (c) => c.html(pageForm()))

app.post('/admin/page', async (c) => {
  const form = await c.req.formData()
  const title = (form.get('title') as string ?? '').trim()
  const slug = (form.get('slug') as string ?? '').trim().replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const body = (form.get('body') as string ?? '').replace(/\r\n/g,'\n').trim()
  if (!title || !slug || !body) return c.redirect('/admin/page/new')
  await createPage(c, title, slug, body)
  return c.redirect('/admin/pages')
})

app.get('/admin/page/:id/edit', async (c) => {
  const page = await getPageById(c, Number(c.req.param('id')))
  if (!page) return c.notFound()
  return c.html(pageForm(page))
})

app.post('/admin/page/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const existing = await getPageById(c, id)
  if (!existing) return c.notFound()
  const form = await c.req.formData()
  const title = (form.get('title') as string ?? '').trim()
  const slug = (form.get('slug') as string ?? '').trim().replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const body = (form.get('body') as string ?? '').replace(/\r\n/g,'\n').trim()
  if (!title || !slug || !body) return c.redirect(`/admin/page/${c.req.param('id')}/edit`)
  await updatePage(c, id, title, slug, body)
  await deleteRemovedImages(c.env, existing.body, body)
  return c.redirect('/admin/pages')
})

app.post('/admin/page/:id/delete', async (c) => {
  const id = Number(c.req.param('id'))
  const page = await getPageById(c, id)
  await deletePage(c, id)
  if (page) await deleteImageKeys(c.env, extractImageKeys(page.body))
  return c.redirect('/admin/pages')
})

app.post('/admin/page/:id/publish', async (c) => {
  await togglePagePublish(c, Number(c.req.param('id')))
  return c.redirect('/admin/pages')
})

export default app
