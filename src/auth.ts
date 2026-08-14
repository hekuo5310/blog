import type { Context } from 'hono'
import type { Env } from './index'

const LOGIN_ATTEMPT_LIMIT = 5
const LOGIN_ATTEMPT_TTL = 15 * 60
const SESSION_TTL = 86400
const SESSION_COOKIE = '__Host-session'
const DEV_SESSION_COOKIE = 'session'

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get('Cookie') ?? ''
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    if (trimmed.slice(0, eq) === name) return decodeURIComponent(trimmed.slice(eq + 1))
  }
}

function secureRequest(c: Context<{ Bindings: Env }>): boolean {
  return new URL(c.req.url).protocol === 'https:'
}

function sessionCookieName(secure: boolean): string {
  return secure ? SESSION_COOKIE : DEV_SESSION_COOKIE
}

function sameOrigin(c: Context<{ Bindings: Env }>): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) return true
  const target = new URL(c.req.url).origin
  const origin = c.req.header('Origin')
  if (origin) return origin === target
  const referer = c.req.header('Referer')
  if (!referer) return false
  try {
    return new URL(referer).origin === target
  } catch {
    return false
  }
}

export async function createSession(env: Env): Promise<string> {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const token = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  await env.SESSIONS.put(token, '1', { expirationTtl: SESSION_TTL })
  return token
}

export async function validateSession(c: Context<{ Bindings: Env }>): Promise<boolean> {
  if (!sameOrigin(c)) return false
  const secure = secureRequest(c)
  const token = getCookie(c.req.raw, sessionCookieName(secure))
  if (!token) return false
  const val = await c.env.SESSIONS.get(token)
  return val !== null
}

export async function deleteSession(c: Context<{ Bindings: Env }>): Promise<void> {
  const secure = secureRequest(c)
  const token = getCookie(c.req.raw, sessionCookieName(secure))
  if (token) await c.env.SESSIONS.delete(token)
}

export function sessionCookie(token: string, secure = true): string {
  const name = sessionCookieName(secure)
  return `${name}=${encodeURIComponent(token)}; HttpOnly${secure ? '; Secure' : ''}; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}`
}

export function clearCookie(secure = true): string {
  const name = sessionCookieName(secure)
  return `${name}=; HttpOnly${secure ? '; Secure' : ''}; SameSite=Strict; Path=/; Max-Age=0`
}

async function loginAttemptKey(c: Context<{ Bindings: Env }>): Promise<string> {
  const source = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  const id = [...new Uint8Array(digest)].slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `admin:login-attempts:${id}`
}

export async function isLoginRateLimited(c: Context<{ Bindings: Env }>): Promise<boolean> {
  if (!sameOrigin(c)) return true
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
