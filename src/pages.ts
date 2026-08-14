import type { Context } from 'hono'
import type { Env } from './index'

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
