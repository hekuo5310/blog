import type { Context } from 'hono'
import type { Env } from './index'
import type { Post, PostActivity, PostActivityChanges } from './html'
import { pinyin } from 'pinyin-pro'
import type { ArticleLicenseInput } from './licenses'
import { CUSTOM_ARTICLE_LICENSE, articleLicenseDisplayName, normalizeArticleLicense, normalizeArticleLicenseInput } from './licenses'

function toSlug(title: string): string {
  const py = pinyin(title, { toneType: 'none', type: 'array' }).join('')
  return py
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post'
}

function normalizeCustomSlug(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function uniqueSlug(c: Context<{ Bindings: Env }>, base: string, excludeId?: number) {
  let slug = base
  let suffix = 2
  while (await c.env.DB.prepare(`SELECT 1 FROM posts WHERE slug=?${excludeId ? ' AND id<>?' : ''}`)
    .bind(...(excludeId ? [slug, excludeId] : [slug])).first()) {
    const suffixText = `-${suffix++}`
    slug = `${base.slice(0, 80 - suffixText.length)}${suffixText}`
  }
  return slug
}

export async function listPublicPosts(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.DB.prepare('SELECT * FROM posts WHERE published=1 ORDER BY created_at DESC').all<Post>()
  return results
}

export async function searchPublicPosts(c: Context<{ Bindings: Env }>, query: string) {
  const normalized = query.trim().replace(/[%_]/g, '\\$&').slice(0, 100)
  if (!normalized) return []
  const pattern = `%${normalized}%`
  const { results } = await c.env.DB.prepare(`
    SELECT * FROM posts
    WHERE published=1 AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')
    ORDER BY CASE WHEN title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, created_at DESC
    LIMIT 50
  `).bind(pattern, pattern, pattern).all<Post>()
  return results
}

type ActivityRow = Omit<PostActivity, 'changes'> & { changes: string }

export async function listPublicPostActivities(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.DB.prepare(`
    SELECT a.id, a.post_id, p.title AS post_title, p.slug AS post_slug,
      a.event_type, a.changes, a.created_at
    FROM post_activities a
    JOIN posts p ON p.id=a.post_id
    WHERE p.published=1
    ORDER BY a.created_at ASC, a.id ASC
  `).all<ActivityRow>()
  return results.map(row => {
    let changes: PostActivityChanges = {}
    try { changes = JSON.parse(row.changes) } catch {}
    return { ...row, changes } as PostActivity
  })
}

export async function getPublishedPostBySlug(c: Context<{ Bindings: Env }>, slug: string) {
  return c.env.DB.prepare('SELECT * FROM posts WHERE slug=? AND published=1').bind(slug).first<Post>()
}

export async function getPostById(c: Context<{ Bindings: Env }>, id: number) {
  return c.env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first<Post>()
}

export async function adminListPosts(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all<Post>()
  return results
}

export async function createPost(c: Context<{ Bindings: Env }>, title: string, requestedSlug: string, body: string, aiSummary: string | null, license: ArticleLicenseInput) {
  const baseSlug = normalizeCustomSlug(requestedSlug) || toSlug(title)
  const slug = await uniqueSlug(c, baseSlug)
  const normalized = normalizeArticleLicenseInput(license.license, license.customName, license.customText)
  await c.env.DB.prepare('INSERT INTO posts (title,slug,body,ai_summary,license,custom_license_name,custom_license_text) VALUES (?,?,?,?,?,?,?)')
    .bind(title, slug, body, aiSummary, normalized.license, normalized.customName, normalized.customText).run()
  return slug
}

function clipChange(value: string, maxLength = 2400): { text: string; truncated: boolean } {
  if (value.length <= maxLength) return { text: value, truncated: false }
  const half = Math.floor(maxLength / 2)
  return { text: `${value.slice(0, half)}\n...\n${value.slice(-half)}`, truncated: true }
}

function bodyChange(before: string, after: string): PostActivityChanges['body'] {
  let start = 0
  const maxStart = Math.min(before.length, after.length)
  while (start < maxStart && before[start] === after[start]) start++

  let beforeEnd = before.length
  let afterEnd = after.length
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd--
    afterEnd--
  }

  const lineStart = before.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const beforeLineEnd = before.indexOf('\n', beforeEnd)
  const afterLineEnd = after.indexOf('\n', afterEnd)
  const removed = clipChange(before.slice(lineStart, beforeLineEnd < 0 ? before.length : beforeLineEnd))
  const added = clipChange(after.slice(lineStart, afterLineEnd < 0 ? after.length : afterLineEnd))
  return { removed: removed.text, added: added.text, truncated: removed.truncated || added.truncated }
}

export function describePostChanges(existing: Pick<Post, 'title' | 'slug' | 'body' | 'license' | 'custom_license_name' | 'custom_license_text'>, title: string, slug: string, body: string, license: ArticleLicenseInput): PostActivityChanges {
  const changes: PostActivityChanges = {}
  if (existing.title !== title) changes.title = { before: existing.title, after: title }
  if (existing.slug !== slug) changes.slug = { before: existing.slug, after: slug }
  if (existing.body !== body) changes.body = bodyChange(existing.body, body)
  const oldLicense = normalizeArticleLicense(existing.license)
  const oldCustomName = existing.custom_license_name ?? ''
  const oldCustomText = existing.custom_license_text ?? ''
  const newLicense = normalizeArticleLicense(license.license)
  const customChanged = newLicense === CUSTOM_ARTICLE_LICENSE && (oldCustomName !== license.customName || oldCustomText !== license.customText)
  if (oldLicense !== newLicense || customChanged) {
    changes.license = {
      before: articleLicenseDisplayName(oldLicense, oldCustomName),
      after: articleLicenseDisplayName(newLicense, license.customName),
      customTextChanged: oldCustomText !== license.customText
    }
  }
  return changes
}

export async function updatePost(c: Context<{ Bindings: Env }>, existing: Post, title: string, requestedSlug: string, body: string, aiSummary: string | null, license: ArticleLicenseInput) {
  const baseSlug = normalizeCustomSlug(requestedSlug) || toSlug(title)
  const slug = await uniqueSlug(c, baseSlug, existing.id)
  const normalizedLicense = normalizeArticleLicenseInput(license.license, license.customName, license.customText)
  const changes = describePostChanges(existing, title, slug, body, normalizedLicense)
  if (!changes.title && !changes.slug && !changes.body && !changes.license) return false

  const statements = [
    c.env.DB.prepare('UPDATE posts SET title=?,slug=?,body=?,ai_summary=?,license=?,custom_license_name=?,custom_license_text=? WHERE id=?')
      .bind(title, slug, body, aiSummary, normalizedLicense.license, normalizedLicense.customName, normalizedLicense.customText, existing.id)
  ]
  if (existing.published) {
    statements.push(c.env.DB.prepare(`
      INSERT INTO post_activities (post_id,post_title,post_slug,event_type,changes)
      VALUES (?,?,?,?,?)
    `).bind(existing.id, title, slug, 'updated', JSON.stringify(changes)))
  }
  await c.env.DB.batch(statements)
  return true
}

export async function deletePost(c: Context<{ Bindings: Env }>, id: number) {
  await c.env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id).run()
}

export async function togglePublish(c: Context<{ Bindings: Env }>, id: number) {
  const post = await getPostById(c, id)
  if (!post) return false
  if (post.published) {
    await c.env.DB.prepare('UPDATE posts SET published=0 WHERE id=?').bind(id).run()
  } else {
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE posts SET published=1 WHERE id=?').bind(id),
      c.env.DB.prepare(`
        INSERT INTO post_activities (post_id,post_title,post_slug,event_type,changes)
        VALUES (?,?,?,?,?)
      `).bind(post.id, post.title, post.slug, 'published', JSON.stringify({ published: true }))
    ])
  }
  return true
}
