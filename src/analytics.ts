import type { Context } from 'hono'
import type { Env } from './index'
import { formatUtc8DateTime } from './time'

export type StatItem = { label: string; views: number }
export type DailyStat = { date: string; views: number }
export type StatsReport = {
  total: number
  today: number
  last30Days: number
  daily: DailyStat[]
  topPages: StatItem[]
  referrers: StatItem[]
  devices: StatItem[]
  generatedAt: string
}

const BOT_PATTERN = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|uptime|monitor/i
const EXCLUDED_PATHS = ['/healthz', '/rss.xml', '/feed.xml', '/updates.json', '/stats', '/stats.json', '/favicon.ico']

function deviceFromUserAgent(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return 'tablet'
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

function externalReferrerHost(requestUrl: string, referrer?: string): string | null {
  if (!referrer) return null
  try {
    const current = new URL(requestUrl)
    const source = new URL(referrer)
    return source.hostname === current.hostname ? null : source.hostname.toLowerCase().slice(0, 200)
  } catch {
    return null
  }
}

export function shouldRecordPageView(c: Context<{ Bindings: Env }>): boolean {
  if (c.req.method !== 'GET' || c.res.status < 200 || c.res.status >= 400) return false
  const path = c.req.path
  if (path.startsWith('/admin') || path.startsWith('/images/') || EXCLUDED_PATHS.includes(path)) return false
  if (c.req.header('DNT') === '1' || c.req.header('Sec-GPC') === '1') return false
  if (c.req.header('Purpose') === 'prefetch' || c.req.header('Sec-Purpose')?.includes('prefetch')) return false
  return !BOT_PATTERN.test(c.req.header('User-Agent') || '')
}

export async function recordPageView(c: Context<{ Bindings: Env }>): Promise<void> {
  const path = (c.req.path.length > 1 ? c.req.path.replace(/\/+$/, '') : '/').slice(0, 300)
  const userAgent = c.req.header('User-Agent') || ''
  await c.env.DB.prepare('INSERT INTO page_views (path,referrer_host,device) VALUES (?,?,?)')
    .bind(path, externalReferrerHost(c.req.url, c.req.header('Referer')), deviceFromUserAgent(userAgent)).run()
}

function numberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

async function count(c: Context<{ Bindings: Env }>, sql: string): Promise<number> {
  const row = await c.env.DB.prepare(sql).first<{ views: number }>()
  return numberValue(row?.views)
}

function last30Utc8Days(): string[] {
  const today = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - (29 - index))
    return date.toISOString().slice(0, 10)
  })
}

export async function getPublicStats(c: Context<{ Bindings: Env }>): Promise<StatsReport> {
  const [total, today, last30Days, dailyRows, pageRows, referrerRows, deviceRows] = await Promise.all([
    count(c, 'SELECT COUNT(*) AS views FROM page_views'),
    count(c, "SELECT COUNT(*) AS views FROM page_views WHERE date(created_at,'+8 hours')=date('now','+8 hours')"),
    count(c, "SELECT COUNT(*) AS views FROM page_views WHERE created_at>=datetime('now','-30 days')"),
    c.env.DB.prepare(`SELECT date(created_at,'+8 hours') AS label, COUNT(*) AS views
      FROM page_views WHERE created_at>=datetime('now','-30 days') GROUP BY label ORDER BY label`).all<StatItem>(),
    c.env.DB.prepare(`SELECT path AS label, COUNT(*) AS views FROM page_views
      WHERE created_at>=datetime('now','-30 days') GROUP BY path ORDER BY views DESC, path LIMIT 10`).all<StatItem>(),
    c.env.DB.prepare(`SELECT COALESCE(referrer_host,'直接访问') AS label, COUNT(*) AS views FROM page_views
      WHERE created_at>=datetime('now','-30 days') GROUP BY referrer_host ORDER BY views DESC LIMIT 8`).all<StatItem>(),
    c.env.DB.prepare(`SELECT device AS label, COUNT(*) AS views FROM page_views
      WHERE created_at>=datetime('now','-30 days') GROUP BY device ORDER BY views DESC`).all<StatItem>()
  ])

  const dailyMap = new Map(dailyRows.results.map(row => [row.label, numberValue(row.views)]))
  return {
    total,
    today,
    last30Days,
    daily: last30Utc8Days().map(date => ({ date, views: dailyMap.get(date) || 0 })),
    topPages: pageRows.results.map(row => ({ label: row.label, views: numberValue(row.views) })),
    referrers: referrerRows.results.map(row => ({ label: row.label, views: numberValue(row.views) })),
    devices: deviceRows.results.map(row => ({ label: row.label, views: numberValue(row.views) })),
    generatedAt: formatUtc8DateTime(new Date().toISOString())
  }
}
