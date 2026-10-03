import type { Context } from 'hono'
import type { Env } from './index'
import { hashEqual } from './auth'
import { isConfigured } from './config'

export const CHATGPT_BODY_LIMIT = 256 * 1024
const SCALARS = ['totalTokens', 'peakDailyTokens', 'longestTaskSeconds', 'longestStreakDays', 'currentStreakDays'] as const
const SERIES = ['daily', 'weekly', 'cumulative'] as const
const FIELDS: readonly string[] = [...SCALARS, ...SERIES]
export type TokenBucket = { start_date: string; tokens: number; chat_turns?: number }
export type ChatGPTStats = Record<typeof SCALARS[number], number> & Record<typeof SERIES[number], TokenBucket[]>
export type StoredChatGPTStats = ChatGPTStats & { updatedAt: string }
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const ms = Date.parse(value + 'T00:00:00.000Z')
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value
}
/** The captured Profile buckets contain only start_date, tokens, and chat_turns.
 * Reconstruct all accepted objects so no raw response, credentials, or unknown metadata reaches KV. */
export function validateChatGPTStats(value: unknown): ChatGPTStats | null {
  if (!object(value) || Object.keys(value).some(key => !FIELDS.includes(key))) return null
  const result = {} as ChatGPTStats
  for (const key of SCALARS) {
    if (!nonnegative(value[key])) return null
    result[key] = value[key]
  }
  for (const key of SERIES) {
    const rows = value[key]
    if (!Array.isArray(rows) || rows.length > 5000) return null
    const seen = new Set<string>()
    const buckets: TokenBucket[] = []
    for (const row of rows) {
      if (!object(row) || Object.keys(row).some(k => !['start_date', 'tokens', 'chat_turns'].includes(k))) return null
      if (!date(row.start_date) || !nonnegative(row.tokens) || seen.has(row.start_date)) return null
      if ('chat_turns' in row && !nonnegative(row.chat_turns)) return null
      seen.add(row.start_date)
      buckets.push({ start_date: row.start_date, tokens: row.tokens, ...('chat_turns' in row ? { chat_turns: row.chat_turns as number } : {}) })
    }
    result[key] = buckets
  }
  return result
}
class InputError extends Error { constructor(readonly status: 400 | 413) { super('Invalid input') } }
async function readPayload(request: Request): Promise<unknown> {
  const length = request.headers.get('Content-Length')
  if (length && /^\d+$/.test(length) && Number(length) > CHATGPT_BODY_LIMIT) throw new InputError(413)
  const reader = request.body?.getReader()
  if (!reader) throw new InputError(400)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > CHATGPT_BODY_LIMIT) { await reader.cancel(); throw new InputError(413) }
      chunks.push(part.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes))
  } catch (error) {
    if (error instanceof InputError) throw error
    throw new InputError(400)
  } finally { reader.releaseLock() }
}
export async function updateChatGPTStats(c: Context<{ Bindings: Env }>) {
  c.header('Cache-Control', 'no-store')
  if (!isConfigured(c.env.SYNC_TOKEN)) return c.json({ error: '统计同步尚未配置' }, 503)
  const auth = c.req.header('Authorization') || ''
  const match = /^Bearer (\S+)$/i.exec(auth)
  if (!match || !await hashEqual(match[1], c.env.SYNC_TOKEN!)) return c.json({ error: 'Unauthorized' }, 401)
  if (!c.env.CHATGPT_STATS) return c.json({ error: '统计存储尚未配置' }, 503)
  if (!/^application\/json(?:\s*;|$)/i.test(c.req.header('Content-Type') || '')) return c.json({ error: '请求必须为 JSON' }, 400)
  let payload: unknown
  try { payload = await readPayload(c.req.raw) }
  catch (error) { return c.json({ error: error instanceof InputError && error.status === 413 ? '请求体超过 256 KiB' : '无效 JSON' }, error instanceof InputError ? error.status : 400) }
  const stats = validateChatGPTStats(payload)
  if (!stats) return c.json({ error: '统计字段无效' }, 400)
  const stored: StoredChatGPTStats = { ...stats, updatedAt: new Date().toISOString() }
  try { await c.env.CHATGPT_STATS.put('profile', JSON.stringify(stored)) }
  catch { return c.json({ error: '统计保存失败，请稍后重试' }, 503) }
  return c.json({ ok: true, updatedAt: stored.updatedAt })
}
export async function publicChatGPTStats(c: Context<{ Bindings: Env }>) {
  c.header('Cache-Control', 'no-store')
  if (!c.env.CHATGPT_STATS) return c.json({ error: '统计存储尚未配置' }, 503)
  try {
    const raw = await c.env.CHATGPT_STATS.get('profile')
    if (raw === null) { c.header('Cache-Control', 'public, max-age=300'); return c.json(null) }
    const stored: unknown = JSON.parse(raw)
    if (!object(stored)) return c.json({ error: '统计数据暂不可用' }, 503)
    const { updatedAt, ...payload } = stored
    const stats = validateChatGPTStats(payload)
    if (!stats || typeof updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt))) return c.json({ error: '统计数据暂不可用' }, 503)
    c.header('Cache-Control', 'public, max-age=300')
    return c.json({ ...stats, updatedAt })
  } catch { return c.json({ error: '统计读取失败，请稍后重试' }, 503) }
}
