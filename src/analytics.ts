import type { Context } from 'hono'
import type { Env } from './index'
import { formatUtc8DateTime } from './time'

export type StatItem = { label: string; views: number }
export type StatsRange = '24h' | '7d' | '30d' | '90d'
export type TrendStat = { key: string; views: number }
export type StatsReport = {
  total: number
  today: number
  range: StatsRange
  rangeLabel: string
  periodViews: number
  trend: TrendStat[]
  topPages: StatItem[]
  referrers: StatItem[]
  countries: StatItem[]
  devices: StatItem[]
  generatedAt: string
}

const BOT_PATTERN = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|uptime|monitor/i
const EXCLUDED_PATHS = ['/healthz', '/rss.xml', '/feed.xml', '/updates.json', '/stats', '/stats.json', '/favicon.ico']
const RANGE_CONFIG: Record<StatsRange, { label: string; windowStart: string; buckets: number; unit: 'hour' | 'day' }> = {
  '24h': { label: '最近 24 小时', windowStart: "datetime(strftime('%Y-%m-%d %H:00:00','now'),'-23 hours')", buckets: 24, unit: 'hour' },
  '7d': { label: '最近 7 天', windowStart: "datetime(date('now','+8 hours'),'-6 days','-8 hours')", buckets: 7, unit: 'day' },
  '30d': { label: '最近 30 天', windowStart: "datetime(date('now','+8 hours'),'-29 days','-8 hours')", buckets: 30, unit: 'day' },
  '90d': { label: '最近 90 天', windowStart: "datetime(date('now','+8 hours'),'-89 days','-8 hours')", buckets: 90, unit: 'day' }
}

export function normalizeStatsRange(value?: string): StatsRange {
  return value && Object.prototype.hasOwnProperty.call(RANGE_CONFIG, value) ? value as StatsRange : '24h'
}

function deviceFromWidth(width: number): 'desktop' | 'mobile' | 'tablet' {
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

function deviceFromUserAgent(userAgent: string): 'desktop' | 'mobile' | 'tablet' {
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return 'tablet'
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'mobile'
  return 'desktop'
}

/**
 * 设备类型优先按「物理设备宽度」判断，而不是 UA：
 * 手机浏览器开「桌面网站」后 UA 和布局视口都会变成桌面尺寸，
 * 但 Sec-CH-Width（Chromium Client Hint）和 window.screen.width（JS 种入 cookie）不变。
 */
function deviceFromRequest(c: Context<{ Bindings: Env }>): 'desktop' | 'mobile' | 'tablet' {
  const chWidth = c.req.header('Sec-CH-Width')
  if (chWidth && /^\d+$/.test(chWidth)) return deviceFromWidth(Number(chWidth))
  const cookieMatch = (c.req.header('Cookie') || '').match(/(?:^|;\s*)pv_w=(\d+)/)
  if (cookieMatch) return deviceFromWidth(Number(cookieMatch[1]))
  return deviceFromUserAgent(c.req.header('User-Agent') || '')
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

function countryCodeFromRequest(c: Context<{ Bindings: Env }>): string | null {
  const country = c.req.raw.cf?.country
  return typeof country === 'string' && /^[A-Z]{2}$/.test(country) ? country : null
}

function countryLabel(code: string): string {
  const specialNames: Record<string, string> = {
    CN: 'China',
    TW: 'Taiwan, China',
    HK: 'Hong Kong SAR, China',
    MO: 'Macao SAR, China'
  }
  if (!code) return '未知地区'
  if (specialNames[code]) return specialNames[code]
  try {
    return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code) || code
  } catch {
    return code
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
  await c.env.DB.prepare('INSERT INTO page_views (path,referrer_host,device,country_code) VALUES (?,?,?,?)')
    .bind(path, externalReferrerHost(c.req.url, c.req.header('Referer')), deviceFromRequest(c), countryCodeFromRequest(c)).run()
}

function numberValue(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

async function count(c: Context<{ Bindings: Env }>, sql: string): Promise<number> {
  const row = await c.env.DB.prepare(sql).first<{ views: number }>()
  return numberValue(row?.views)
}

function trendKeys(range: StatsRange): string[] {
  const config = RANGE_CONFIG[range]
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  now.setUTCMinutes(0, 0, 0)
  return Array.from({ length: config.buckets }, (_, index) => {
    const date = new Date(now)
    if (config.unit === 'hour') date.setUTCHours(now.getUTCHours() - (config.buckets - 1 - index))
    else date.setUTCDate(now.getUTCDate() - (config.buckets - 1 - index))
    return config.unit === 'hour' ? `${date.toISOString().slice(0, 13)}:00` : date.toISOString().slice(0, 10)
  })
}

export async function getPublicStats(c: Context<{ Bindings: Env }>, requestedRange?: string): Promise<StatsReport> {
  const range = normalizeStatsRange(requestedRange)
  const config = RANGE_CONFIG[range]
  const windowSql = `created_at>=${config.windowStart}`
  const groupExpression = config.unit === 'hour'
    ? "strftime('%Y-%m-%dT%H:00',created_at,'+8 hours')"
    : "date(created_at,'+8 hours')"
  const [total, today, periodViews, trendRows, pageRows, referrerRows, countryRows, deviceRows] = await Promise.all([
    count(c, 'SELECT COUNT(*) AS views FROM page_views'),
    count(c, "SELECT COUNT(*) AS views FROM page_views WHERE date(created_at,'+8 hours')=date('now','+8 hours')"),
    count(c, `SELECT COUNT(*) AS views FROM page_views WHERE ${windowSql}`),
    c.env.DB.prepare(`SELECT ${groupExpression} AS label, COUNT(*) AS views
      FROM page_views WHERE ${windowSql} GROUP BY label ORDER BY label`).all<StatItem>(),
    c.env.DB.prepare(`SELECT path AS label, COUNT(*) AS views FROM page_views
      WHERE ${windowSql} GROUP BY path ORDER BY views DESC, path LIMIT 10`).all<StatItem>(),
    c.env.DB.prepare(`SELECT COALESCE(referrer_host,'直接访问') AS label, COUNT(*) AS views FROM page_views
      WHERE ${windowSql} GROUP BY referrer_host ORDER BY views DESC LIMIT 8`).all<StatItem>(),
    c.env.DB.prepare(`SELECT COALESCE(country_code,'') AS label, COUNT(*) AS views FROM page_views
      WHERE ${windowSql} GROUP BY country_code ORDER BY views DESC, country_code LIMIT 10`).all<StatItem>(),
    c.env.DB.prepare(`SELECT device AS label, COUNT(*) AS views FROM page_views
      WHERE ${windowSql} GROUP BY device ORDER BY views DESC`).all<StatItem>()
  ])

  const trendMap = new Map(trendRows.results.map(row => [row.label, numberValue(row.views)]))
  return {
    total,
    today,
    range,
    rangeLabel: config.label,
    periodViews,
    trend: trendKeys(range).map(key => ({ key, views: trendMap.get(key) || 0 })),
    topPages: pageRows.results.map(row => ({ label: row.label, views: numberValue(row.views) })),
    referrers: referrerRows.results.map(row => ({ label: row.label, views: numberValue(row.views) })),
    countries: countryRows.results.map(row => ({ label: countryLabel(row.label), views: numberValue(row.views) })),
    devices: deviceRows.results.map(row => ({ label: row.label, views: numberValue(row.views) })),
    generatedAt: formatUtc8DateTime(new Date().toISOString())
  }
}
