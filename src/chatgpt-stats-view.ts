import script from './chatgpt-stats-client.js.txt'
export const CHATGPT_STATS_CSS = `
.chatgpt-stats{margin:2rem 0;padding:1.4rem;border:1px solid var(--border);border-radius:6px;background:var(--surface);min-width:0}
.chatgpt-stats h2{font-size:1rem;margin:0}.chatgpt-stats-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1rem}
.chatgpt-stats .stats-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;margin:0}
.chatgpt-stats .stats-kpi-value{font-size:1.4rem}.chatgpt-stats small{display:block;color:var(--muted);font-size:.74rem;margin-top:.35rem;overflow-wrap:anywhere}
.chatgpt-status{color:var(--muted);font-size:.82rem}.chatgpt-status[data-warning="true"]{color:var(--danger)}
.chatgpt-stats [hidden]{display:none!important}.chatgpt-loading .stats-kpi-value{width:70%;height:1.5rem;border-radius:4px;background:var(--bg-soft);animation:chatgpt-pulse 1.4s ease-in-out infinite}
@keyframes chatgpt-pulse{50%{opacity:.4}}@media(prefers-reduced-motion:reduce){.chatgpt-loading .stats-kpi-value{animation:none}}
.chatgpt-chart{margin-top:1.25rem;border-top:1px solid var(--border);padding-top:1rem;min-width:0}.chatgpt-chart-head{display:flex;gap:.75rem;justify-content:space-between;align-items:center;margin-bottom:.7rem;font-size:.8rem;color:var(--muted)}
.chatgpt-year{font:inherit;border:1px solid var(--input-border);border-radius:5px;background:var(--surface);color:var(--text);padding:.2rem .4rem}
.chatgpt-grid-scroll{overflow-x:auto;max-width:100%;padding:3px 2px;scrollbar-width:thin}.chatgpt-grid-scroll .hm-cell{cursor:default}.chatgpt-grid-scroll .hm-cell[data-date]{cursor:pointer}
.chatgpt-selected{min-height:1.2rem;font-size:.75rem;color:var(--muted);margin-top:.5rem;overflow-wrap:anywhere}
.chatgpt-curve{display:block;width:100%;height:auto;color:var(--accent);overflow:visible}.chatgpt-curve text{fill:var(--muted);font-size:12px;font-family:inherit}.chatgpt-curve .cg-axis{stroke:var(--border);stroke-width:1}
.chatgpt-retry{font-size:.8rem;color:var(--muted);text-decoration:underline;background:none;border:0;cursor:pointer;font-family:inherit}
@media(max-width:600px){.chatgpt-stats{padding:1rem}.chatgpt-stats .stats-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.chatgpt-stats .stats-kpi-value{font-size:1.15rem}}
`
export function chatgptStatsCard(): string {
  const cards = [
    ['totalTokens', '累计 Tokens'], ['peakDailyTokens', '单日峰值'], ['longestTaskSeconds', '最长任务'],
    ['longestStreakDays', '最长连续'], ['currentStreakDays', '当前连续'], ['updatedAt', '最近同步'],
  ].map(([key, label]) => `<div class="stats-kpi"><span class="stats-kpi-label">${label}</span><strong class="stats-kpi-value" data-chatgpt-field="${key}"></strong><small data-chatgpt-detail="${key}"></small></div>`).join('')
  return `<section class="chatgpt-stats chatgpt-loading" id="chatgpt-stats" aria-labelledby="chatgpt-stats-title" aria-busy="true">
<div class="chatgpt-stats-head"><h2 id="chatgpt-stats-title">ChatGPT 使用统计</h2><button class="chatgpt-retry" type="button" id="chatgpt-retry" hidden>重试</button></div>
<p class="chatgpt-status" id="chatgpt-status" role="status" aria-live="polite">正在加载统计…</p>
<div id="chatgpt-content"><div class="stats-kpis">${cards}</div>
<div class="chatgpt-chart" id="chatgpt-heatmap-wrap" hidden><div class="chatgpt-chart-head"><span>Token 活跃图</span><label>年份 <select class="chatgpt-year" id="chatgpt-year" aria-label="活跃图年份"></select></label></div><div class="chatgpt-grid-scroll" id="chatgpt-heatmap"></div><div class="hm-legend">少<span class="hm-cell"></span><span class="hm-cell" data-l="1"></span><span class="hm-cell" data-l="2"></span><span class="hm-cell" data-l="3"></span><span class="hm-cell" data-l="4"></span>多</div><p class="chatgpt-selected" id="chatgpt-selected" aria-live="polite">悬停、聚焦或点按格子查看每日 Token 数</p></div>
<div class="chatgpt-chart" id="chatgpt-curve-wrap" hidden><div class="chatgpt-chart-head">累计 Token 趋势</div><div id="chatgpt-curve"></div></div>
</div><noscript><p class="stats-empty">启用 JavaScript 后可查看 ChatGPT 使用统计。</p></noscript></section>
<script>${script}</script>`
}
