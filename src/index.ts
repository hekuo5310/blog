import { Hono } from 'hono'
import type { Context } from 'hono'
import { postList, postDetail, loginPage, userLoginPage, registerPage, adminDashboard, postForm, adminPageDashboard, pageDetail, pageForm, settingsPage, termsPage, privacyPage, DEFAULT_CONFIG } from './html'
import type { GiscusConfig, SiteConfig, Post } from './html'
import { listPages, listPublicPages, getPageBySlug, getPageById, createPage, updatePage, deletePage, togglePagePublish } from './pages'
import { createSession, validateSession, deleteSession, sessionCookie, clearCookie } from './auth'
import { hashPassword, createUserSession, getUserFromSession, deleteUserSession, userSessionCookie, clearUserCookie } from './user-auth'
import { listPublicPosts, listPublicPostActivities, getPostBySlug, getPostById, adminListPosts, createPost, updatePost, deletePost, togglePublish } from './posts'
import { getComments, addComment, deleteComment } from './comments'
import { deleteImageKeys, deleteRemovedImages, extractImageKeys, serveImage, uploadImage } from './images'
import { extractAiSummaryBlocks, blocksEqual, parseSummaries, generateSummaries } from './ai-summary'

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

type User = { id: number; username: string }

const app = new Hono<{ Bindings: Env }>()

async function getLoggedInUser(c: Context<{ Bindings: Env }>): Promise<User | null> {
  const userId = await getUserFromSession(c)
  if (!userId) return null
  return c.env.DB.prepare('SELECT id,username FROM users WHERE id=?').bind(userId).first<User>()
}

async function getConfig(env: Env): Promise<SiteConfig> {
  const raw = await env.SESSIONS.get('site:config')
  if (!raw) return DEFAULT_CONFIG
  try { return JSON.parse(raw) } catch { return DEFAULT_CONFIG }
}

function getGiscusConfig(env: Env): GiscusConfig | null {
  if (!env.GISCUS_REPO_ID || !env.GISCUS_CATEGORY || !env.GISCUS_CATEGORY_ID) return null
  return {
    repo: env.GISCUS_REPO || 'hekuo5310/blog',
    repoId: env.GISCUS_REPO_ID,
    category: env.GISCUS_CATEGORY,
    categoryId: env.GISCUS_CATEGORY_ID,
    mapping: env.GISCUS_MAPPING || 'pathname',
    strict: '0',
    reactionsEnabled: '1',
    emitMetadata: '0',
    inputPosition: 'bottom',
    lang: env.GISCUS_LANG || 'zh-CN'
  }
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function rssDate(value: string): string {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  const date = new Date(normalized)
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
  const [posts, activities, user, cfg] = await Promise.all([listPublicPosts(c), listPublicPostActivities(c), getLoggedInUser(c), getConfig(c.env)])
  return c.html(postList(posts, activities, user?.username, cfg))
})

app.get('/updates.json', async (c) => {
  const posts = await listPublicPosts(c)
  return c.json(posts.map(p => ({ title: p.title, url: `/post/${p.slug}`, createdAt: p.created_at })))
})

app.get('/rss.xml', rssFeed)
app.get('/feed.xml', rssFeed)

app.get('/post/:slug', async (c) => {
  const post = await getPostBySlug(c, c.req.param('slug'))
  if (!post) return c.notFound()
  const [comments, user, cfg] = await Promise.all([getComments(c, post.id), getLoggedInUser(c), getConfig(c.env)])
  return c.html(postDetail(post, comments, user?.username ?? null, cfg, getGiscusConfig(c.env)))
})

app.get('/terms', async (c) => {
  const [user, cfg] = await Promise.all([getLoggedInUser(c), getConfig(c.env)])
  return c.html(termsPage(cfg, user?.username))
})

app.get('/privacy', async (c) => {
  const [user, cfg] = await Promise.all([getLoggedInUser(c), getConfig(c.env)])
  return c.html(privacyPage(cfg, user?.username))
})

app.post('/post/:slug/comment', async (c) => {
  const user = await getLoggedInUser(c)
  if (!user) return c.redirect('/login')
  const post = await getPostBySlug(c, c.req.param('slug'))
  if (!post) return c.notFound()
  const form = await c.req.formData()
  const body = (form.get('body') as string ?? '').replace(/\r\n/g,'\n').trim().slice(0, 1000)
  if (!body) return c.redirect(`/post/${post.slug}`)
  await addComment(c, post.id, user.username, body, user.id)
  return c.redirect(`/post/${post.slug}`)
})

// user auth
app.get('/register', (c) => c.html(registerPage()))
app.post('/register', async (c) => {
  const form = await c.req.formData()
  const username = (form.get('username') as string ?? '').trim().slice(0, 30)
  const password = (form.get('password') as string ?? '')
  if (!username || password.length < 6) return c.html(registerPage('用户名不能为空，密码至少6位'), 400)
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username=?').bind(username).first()
  if (existing) return c.html(registerPage('用户名已存在'), 400)
  const hash = await hashPassword(password)
  await c.env.DB.prepare('INSERT INTO users (username,password_hash) VALUES (?,?)').bind(username, hash).run()
  return c.redirect('/login')
})

app.get('/login', (c) => c.html(userLoginPage()))
app.post('/login', async (c) => {
  const form = await c.req.formData()
  const username = (form.get('username') as string ?? '').trim()
  const password = (form.get('password') as string ?? '')
  const user = await c.env.DB.prepare('SELECT id,password_hash FROM users WHERE username=?').bind(username).first<{ id: number; password_hash: string }>()
  const hash = await hashPassword(password)
  if (!user || user.password_hash !== hash) return c.html(userLoginPage('用户名或密码错误'), 401)
  const token = await createUserSession(c.env, user.id)
  return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': userSessionCookie(token) } })
})

app.post('/logout-user', async (c) => {
  await deleteUserSession(c)
  return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': clearUserCookie() } })
})

// admin auth
app.get('/admin/login', (c) => c.html(loginPage()))
app.post('/admin/login', async (c) => {
  const form = await c.req.formData()
  const username = form.get('username') as string
  const password = form.get('password') as string
  if (username !== c.env.ADMIN_USER || password !== c.env.ADMIN_PASS) {
    return c.html(loginPage('用户名或密码错误'), 401)
  }
  const token = await createSession(c.env)
  return new Response(null, { status: 302, headers: { Location: '/admin', 'Set-Cookie': sessionCookie(token) } })
})

app.post('/admin/logout', async (c) => {
  await deleteSession(c)
  return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': clearCookie() } })
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

// admin posts
app.get('/admin', async (c) => {
  const posts = await adminListPosts(c)
  return c.html(adminDashboard(posts))
})

app.get('/admin/post/new', (c) => c.html(postForm()))
app.post('/admin/post', async (c) => {
  const form = await c.req.formData()
  const title = (form.get('title') as string ?? '').trim()
  const body = (form.get('body') as string ?? '').replace(/\r\n/g,'\n').trim()
  if (!title || !body) return c.redirect('/admin/post/new')
  const blocks = extractAiSummaryBlocks(body)
  const summaries = blocks.length ? await generateSummaries(c.env, blocks) : []
  await createPost(c, title, body, JSON.stringify(summaries))
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
  const title = (form.get('title') as string ?? '').trim()
  const body = (form.get('body') as string ?? '').replace(/\r\n/g,'\n').trim()
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
  await updatePost(c, existing, title, body, newBlocks.length ? JSON.stringify(summaries) : null)
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

app.post('/admin/comment/:id/delete', async (c) => {
  await deleteComment(c, Number(c.req.param('id')))
  return c.redirect('/admin')
})

// public pages
app.get('/p/:slug', async (c) => {
  const page = await getPageBySlug(c, c.req.param('slug'))
  if (!page) return c.notFound()
  const [user, cfg] = await Promise.all([getLoggedInUser(c), getConfig(c.env)])
  return c.html(pageDetail(page, cfg, user?.username))
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
