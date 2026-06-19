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

export async function createPage(c: Context<{ Bindings: Env }>, title: string, slug: string, body: string) {
  await c.env.DB.prepare('INSERT INTO pages (title,slug,body) VALUES (?,?,?)').bind(title, slug, body).run()
}

export async function updatePage(c: Context<{ Bindings: Env }>, id: number, title: string, slug: string, body: string) {
  await c.env.DB.prepare('UPDATE pages SET title=?,slug=?,body=? WHERE id=?').bind(title, slug, body, id).run()
}

export async function deletePage(c: Context<{ Bindings: Env }>, id: number) {
  await c.env.DB.prepare('DELETE FROM pages WHERE id=?').bind(id).run()
}

export async function togglePagePublish(c: Context<{ Bindings: Env }>, id: number) {
  await c.env.DB.prepare('UPDATE pages SET published=1-published WHERE id=?').bind(id).run()
}
