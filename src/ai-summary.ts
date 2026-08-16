import type { Env } from './index'
import { isConfigured } from './config'

// Matches every [ai-summary]...[/ai-summary] block, capturing inner content.
const BLOCK_RE = /\[ai-summary\]([\s\S]*?)\[\/ai-summary\]/g

/** Extract the inner content of every [ai-summary]...[/ai-summary] block, in order. */
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

/** Parse the stored ai_summary JSON into a string array. */
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

/**
 * Summarize every block via an OpenAI-compatible chat completions endpoint.
 * Returns one summary string per block (empty string on failure). One-time
 * at save time; render never calls this.
 */
export async function generateSummaries(env: Env, blocks: string[]): Promise<string[]> {
  const key = env.OPENAI_API_KEY
  if (!isConfigured(key) || !blocks.length) return blocks.map(() => '')
  const baseUrl = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = env.OPENAI_MODEL || 'gpt-4o-mini'
  return Promise.all(blocks.map(async (block) => {
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: block }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      })
      if (!res.ok) return ''
      const data: any = await res.json()
      const text = data?.choices?.[0]?.message?.content
      return typeof text === 'string' ? text.trim() : ''
    } catch {
      return ''
    }
  }))
}
export async function polishParagraphs(env: Env, paragraphs: string[]): Promise<string[]> {
  if (!isConfigured(env.OPENAI_API_KEY)) return paragraphs.map(() => '')
  const base = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const res = await fetch(`${base}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'system', content: '润色中文文章。保持原意、Markdown 和事实，不要解释。按输入 JSON 数组顺序，只返回等长 JSON 字符串数组。' }, { role: 'user', content: JSON.stringify(paragraphs) }], temperature: .35 }) })
  if (!res.ok) return paragraphs.map(() => '')
  try { const data: any = await res.json(); const text = data?.choices?.[0]?.message?.content; const value = JSON.parse(text); return Array.isArray(value) ? paragraphs.map((_, i) => typeof value[i] === 'string' ? value[i].trim() : '') : paragraphs.map(() => '') } catch { return paragraphs.map(() => '') }
}
