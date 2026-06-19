import type { Context } from 'hono'
import type { Env } from './index'

export async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function createUserSession(env: Env, userId: number): Promise<string> {
  const token = crypto.randomUUID()
  await env.SESSIONS.put(`user:${token}`, String(userId), { expirationTtl: 86400 })
  return token
}

export async function getUserFromSession(c: Context<{ Bindings: Env }>): Promise<number | null> {
  const token = getCookie(c.req.raw, 'user_session')
  if (!token) return null
  const val = await c.env.SESSIONS.get(`user:${token}`)
  return val ? Number(val) : null
}

export async function deleteUserSession(c: Context<{ Bindings: Env }>): Promise<void> {
  const token = getCookie(c.req.raw, 'user_session')
  if (token) await c.env.SESSIONS.delete(`user:${token}`)
}

export function userSessionCookie(token: string): string {
  return `user_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
}

export function clearUserCookie(): string {
  return `user_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
}

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('Cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === name) return v
  }
}
