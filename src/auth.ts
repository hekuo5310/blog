import type { Context } from 'hono'
import type { Env } from './index'

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('Cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === name) return v
  }
}

export async function createSession(env: Env): Promise<string> {
  const token = crypto.randomUUID()
  await env.SESSIONS.put(token, '1', { expirationTtl: 86400 })
  return token
}

export async function validateSession(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const token = getCookie(c.req.raw, 'session')
  if (!token) return false
  const val = await c.env.SESSIONS.get(token)
  return val !== null
}

export async function deleteSession(c: Context<{ Bindings: Env }>): Promise<void> {
  const token = getCookie(c.req.raw, 'session')
  if (token) await c.env.SESSIONS.delete(token)
}

export function sessionCookie(token: string): string {
  return `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
}

export function clearCookie(): string {
  return `session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
}
