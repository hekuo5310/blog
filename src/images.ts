import type { Context } from 'hono'
import type { Env } from './index'

const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const IMAGE_PATH_PREFIX = '/images/'

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif'
}

export async function uploadImage(c: Context<{ Bindings: Env }>) {
  const form = await c.req.formData()
  const entry = form.get('image')
  if (!entry || typeof entry === 'string' || typeof (entry as File).arrayBuffer !== 'function') {
    return c.json({ error: 'missing image' }, 400)
  }
  const file = entry as File
  const ext = EXT_BY_TYPE[file.type]
  if (!ext) return c.json({ error: 'unsupported image type' }, 415)
  if (file.size > MAX_IMAGE_SIZE) return c.json({ error: 'image too large' }, 413)

  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const key = `uploads/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`
  await c.env.IMAGES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name || 'pasted-image' }
  })

  return c.json({ key, url: `${IMAGE_PATH_PREFIX}${key}` })
}

export async function serveImage(c: Context<{ Bindings: Env }>) {
  const key = c.req.path.slice(IMAGE_PATH_PREFIX.length)
  if (!key || key.includes('..') || key.startsWith('/')) return c.notFound()
  const object = await c.env.IMAGES.get(key)
  if (!object) return c.notFound()

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  headers.set('x-content-type-options', 'nosniff')
  headers.set('cross-origin-resource-policy', 'same-site')
  return new Response(object.body, { headers })
}

export function extractImageKeys(markdown: string): string[] {
  const keys = new Set<string>()
  const re = /\/images\/([A-Za-z0-9][A-Za-z0-9/_\-.]*[A-Za-z0-9])/g
  for (const match of markdown.matchAll(re)) keys.add(match[1])
  return [...keys]
}

async function isImageReferenced(env: Env, key: string): Promise<boolean> {
  const marker = `%/images/${key}%`
  const row = await env.DB.prepare(`
    SELECT 1 AS found FROM posts WHERE body LIKE ? LIMIT 1
  `).bind(marker).first<{ found: number }>()
  if (row) return true
  const page = await env.DB.prepare(`
    SELECT 1 AS found FROM pages WHERE body LIKE ? LIMIT 1
  `).bind(marker).first<{ found: number }>()
  return Boolean(page)
}

export async function deleteImageKeys(env: Env, keys: string[]) {
  const unique = [...new Set(keys)].filter(Boolean)
  await Promise.all(unique.map(async key => {
    if (await isImageReferenced(env, key)) return
    await env.IMAGES.delete(key)
  }))
}

export async function deleteRemovedImages(env: Env, oldBody: string, nextBody: string) {
  const next = new Set(extractImageKeys(nextBody))
  const removed = extractImageKeys(oldBody).filter(key => !next.has(key))
  await deleteImageKeys(env, removed)
}
