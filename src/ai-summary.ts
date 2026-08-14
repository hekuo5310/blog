import type { Env } from './index'

const BLOCK_RE = /\[ai-summary\]([\s\S]*?)\[\/ai-summary\]/g
const AI_TIMEOUT_MS = 30_000
const MAX_SUMMARY_BLOCK_CHARS = 20_000
const MAX_POLISH_PARAGRAPHS = 50
const MAX_POLISH_CHARS = 120_000

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: unknown } }>
}

export function extractAiSummaryBlocks(body: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  BLOCK_RE.lastIndex = 0
  while ((m = BLOCK_RE.exec(body)) !== null) out.push(m[1].trim())
  return out
}

export function blocksEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

export function parseSummaries(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const a = JSON.parse(raw)
    return Array.isArray(a) ? a.map(s => (typeof s === 'string' ? s : '')).filter(Boolean) : []
  } catch {
    return []
  }
}

const SYSTEM_PROMPT =
  '你是中文总结助手。用简洁的中文总结用户给出内容的要点，不超过150字，不要寒暄、不要复述指令，直接输出总结正文。'

async function chatCompletion(env: Env, messages: Array<{ role: 'system' | 'user'; content: string }>, maxTokens: number): Promise<string> {
  const key = env.OPENAI_API_KEY
  if (!key) return ''
  const baseUrl = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = env.OPENAI_MODEL || 'gpt-4o-mini'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
      signal: controller.signal
    })
    if (!res.ok) return ''
    const data = await res.json<ChatCompletionResponse>()
    const text = data.choices?.[0]?.message?.content
    return typeof text === 'string' ? text.trim() : ''
  } catch {
    return ''
  } finally {
    clearTimeout(timeout)
  }
}

export async function generateSummaries(env: Env, blocks: string[]): Promise<string[]> {
  if (!env.OPENAI_API_KEY || !blocks.length) return blocks.map(() => '')
  return Promise.all(blocks.map(async block => {
    if (block.length > MAX_SUMMARY_BLOCK_CHARS) return ''
    return chatCompletion(env, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: block }
    ], 500)
  }))
}

export async function polishParagraphs(env: Env, paragraphs: string[]): Promise<string[]> {
  if (!env.OPENAI_API_KEY || paragraphs.length > MAX_POLISH_PARAGRAPHS) return paragraphs.map(() => '')
  if (paragraphs.reduce((total, paragraph) => total + paragraph.length, 0) > MAX_POLISH_CHARS) return paragraphs.map(() => '')

  const text = await chatCompletion(env, [
    { role: 'system', content: '润色中文文章。保持原意、Markdown 和事实，不要解释。按输入 JSON 数组顺序，只返回等长 JSON 字符串数组。' },
    { role: 'user', content: JSON.stringify(paragraphs) }
  ], 4000)
  if (!text) return paragraphs.map(() => '')
  try {
    const value: unknown = JSON.parse(text)
    return Array.isArray(value)
      ? paragraphs.map((_, i) => typeof value[i] === 'string' ? value[i].trim() : '')
      : paragraphs.map(() => '')
  } catch {
    return paragraphs.map(() => '')
  }
}
