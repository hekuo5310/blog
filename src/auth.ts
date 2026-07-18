import type { Context } from 'hono'
import type { Env } from './index'

const LOGIN_ATTEMPT_LIMIT = 5
const LOGIN_ATTEMPT_TTL = 15 * 60

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

export function sessionCookie(token: string, secure = true): string {
  return `session=${token}; HttpOnly${secure ? '; Secure' : ''}; SameSite=Strict; Path=/; Max-Age=86400`
}

export function clearCookie(secure = true): string {
  return `session=; HttpOnly${secure ? '; Secure' : ''}; SameSite=Strict; Path=/; Max-Age=0`
}

async function loginAttemptKey(c: Context<{ Bindings: Env }>): Promise<string> {
  const source = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  const id = [...new Uint8Array(digest)].slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `admin:login-attempts:${id}`
}

export async function isLoginRateLimited(c: Context<{ Bindings: Env }>): Promise<boolean> {
  const attempts = Number(await c.env.SESSIONS.get(await loginAttemptKey(c)) || 0)
  return attempts >= LOGIN_ATTEMPT_LIMIT
}

export async function recordLoginFailure(c: Context<{ Bindings: Env }>): Promise<void> {
  const key = await loginAttemptKey(c)
  const attempts = Number(await c.env.SESSIONS.get(key) || 0)
  await c.env.SESSIONS.put(key, String(attempts + 1), { expirationTtl: LOGIN_ATTEMPT_TTL })
}

export async function clearLoginFailures(c: Context<{ Bindings: Env }>): Promise<void> {
  await c.env.SESSIONS.delete(await loginAttemptKey(c))
}
