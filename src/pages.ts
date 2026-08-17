import type { Context } from 'hono'
import type { Env } from './index'
import { pinyin } from 'pinyin-pro'

export type Page = { id: number; title: string; slug: string; body: string; published: number; created_at: string }

export async function listPages(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.DB.prepare('SELECT * FROM pages ORDER BY created_at ASC').all<Page>()
  return results
}

export async function listPublicPages(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.DB.prepare('SELECT * FROM pages WHERE published=1 ORDER BY created_at ASC').all<Page>()
  return results
}

export async function getPageBySlug(c: Context<{ Bindings: Env }>, slug: string) {
  return c.env.DB.prepare('SELECT * FROM pages WHERE slug=? AND published=1').bind(slug).first<Page>()
}

export async function getPageById(c: Context<{ Bindings: Env }>, id: number) {
  return c.env.DB.prepare('SELECT * FROM pages WHERE id=?').bind(id).first<Page>()
}

async function uniqueSlug(c: Context<{ Bindings: Env }>, base: string, excludeId?: number): Promise<string> {
  let slug = base.slice(0, 80)
  let suffix = 2
  while (await c.env.DB.prepare(`SELECT 1 FROM pages WHERE slug=?${excludeId ? ' AND id<>?' : ''}`)
    .bind(...(excludeId ? [slug, excludeId] : [slug])).first()) {
    const suffixText = `-${suffix++}`
    slug = `${base.slice(0, 80 - suffixText.length)}${suffixText}`
  }
  return slug
}

export async function createPage(c: Context<{ Bindings: Env }>, title: string, slug: string, body: string) {
  const unique = await uniqueSlug(c, slug)
  await c.env.DB.prepare('INSERT INTO pages (title,slug,body) VALUES (?,?,?)').bind(title, unique, body).run()
  return unique
}

export async function updatePage(c: Context<{ Bindings: Env }>, id: number, title: string, slug: string, body: string) {
  const unique = await uniqueSlug(c, slug, id)
  await c.env.DB.prepare('UPDATE pages SET title=?,slug=?,body=? WHERE id=?').bind(title, unique, body, id).run()
  return unique
}

export async function deletePage(c: Context<{ Bindings: Env }>, id: number) {
  await c.env.DB.prepare('DELETE FROM pages WHERE id=?').bind(id).run()
}

export async function togglePagePublish(c: Context<{ Bindings: Env }>, id: number) {
  await c.env.DB.prepare('UPDATE pages SET published=1-published WHERE id=?').bind(id).run()
}

function toSlug(title: string): string {
  const py = pinyin(title, { toneType: 'none', type: 'array' }).join('')
  return py
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'page'
}

export type PageAutosaveResult =
  | { status: 'saved'; id: number }
  | { status: 'noop' }
  | { status: 'missing' }
  | { status: 'declined' }

/** 同 autosavePost：把页面编辑器内容作为普通草稿写入 D1。 */
export async function autosavePage(c: Context<{ Bindings: Env }>, id: number | null, title: string, body: string): Promise<PageAutosaveResult> {
  const cleanTitle = title.trim().slice(0, 200)
  const cleanBody = body.replace(/\r\n/g, '\n').trim().slice(0, 200000)
  if (!cleanTitle && !cleanBody) return { status: 'noop' }

  if (id !== null) {
    const existing = await getPageById(c, id)
    if (!existing) return { status: 'missing' }
    if (existing.published) return { status: 'declined' }
    await c.env.DB.prepare('UPDATE pages SET title=?, body=? WHERE id=?')
      .bind(cleanTitle || existing.title, cleanBody, id).run()
    return { status: 'saved', id }
  }

  const finalTitle = cleanTitle || '无标题草稿'
  const slug = await uniqueSlug(c, toSlug(finalTitle))
  await c.env.DB.prepare('INSERT INTO pages (title,slug,body) VALUES (?,?,?)').bind(finalTitle, slug, cleanBody).run()
  const row = await c.env.DB.prepare('SELECT last_insert_rowid() AS id').first<{ id: number }>()
  return { status: 'saved', id: Number(row?.id ?? 0) }
}
