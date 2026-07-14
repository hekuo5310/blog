import type { Context } from 'hono'
import type { Env } from './index'
import type { Post } from './html'
import { pinyin } from 'pinyin-pro'

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

export async function listPublicPosts(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.DB.prepare('SELECT * FROM posts WHERE published=1 ORDER BY created_at DESC').all<Post>()
  return results
}

export async function getPostBySlug(c: Context<{ Bindings: Env }>, slug: string) {
  return c.env.DB.prepare('SELECT * FROM posts WHERE slug=?').bind(slug).first<Post>()
}

export async function getPostById(c: Context<{ Bindings: Env }>, id: number) {
  return c.env.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first<Post>()
}

export async function adminListPosts(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.DB.prepare('SELECT * FROM posts ORDER BY created_at DESC').all<Post>()
  return results
}

export async function createPost(c: Context<{ Bindings: Env }>, title: string, body: string, aiSummary: string | null) {
  const slug = toSlug(title)
  await c.env.DB.prepare('INSERT INTO posts (title,slug,body,ai_summary) VALUES (?,?,?,?)').bind(title, slug, body, aiSummary).run()
  return slug
}

export async function updatePost(c: Context<{ Bindings: Env }>, id: number, title: string, body: string, aiSummary: string | null) {
  await c.env.DB.prepare('UPDATE posts SET title=?,body=?,ai_summary=? WHERE id=?').bind(title, body, aiSummary, id).run()
}

export async function deletePost(c: Context<{ Bindings: Env }>, id: number) {
  await c.env.DB.prepare('DELETE FROM posts WHERE id=?').bind(id).run()
}

export async function togglePublish(c: Context<{ Bindings: Env }>, id: number) {
  await c.env.DB.prepare('UPDATE posts SET published=1-published WHERE id=?').bind(id).run()
}
