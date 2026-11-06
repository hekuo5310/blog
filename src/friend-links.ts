import { marked, type Token, type Tokens } from 'marked'
import type { SiteConfig } from './html'
import client from './friend-links-client.js.txt'

type Friend = { name: string; url: string; host: string; icon: string; description: string }
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!)
function webUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url : null
  } catch { return null }
}
function plain(tokens: Token[]): string {
  return tokens.map(token => {
    if (token.type === 'html' || token.type === 'image') return ''
    if ('tokens' in token && Array.isArray(token.tokens)) return plain(token.tokens)
    return 'text' in token && typeof token.text === 'string' ? token.text : token.type === 'br' ? '\n' : ''
  }).join('')
}
function friend(item: Tokens.ListItem): Friend | null {
  if (item.task || item.tokens.some(token => !['text','paragraph','space'].includes(token.type))) return null
  const tokens = item.tokens.flatMap(token => 'tokens' in token && Array.isArray(token.tokens) ? token.tokens : [])
  const index = tokens.findIndex(token => token.type === 'link')
  if (index < 0 || tokens.slice(0,index).some(token => token.type !== 'image' && (token.type !== 'text' || token.text.trim()))) return null
  const link = tokens[index] as Tokens.Link, url = webUrl(link.href)
  if (!url) return null
  const name = plain(link.tokens).trim() || url.hostname
  const image = [...tokens.slice(0,index),...link.tokens].find(token => token.type === 'image') as Tokens.Image | undefined
  const icon = image && (webUrl(image.href) || /^\/images\/[A-Za-z0-9._%-]+$/.test(image.href)) ? image.href : new URL('/favicon.ico',url).href
  return { name, url:url.href, host:url.hostname, icon, description:plain(tokens.slice(index+1)).replace(/^\s*[—–:：-]\s*/, '').trim() }
}

/** Existing Markdown remains the source of truth; only simple friend lists become cards. */
export function parseFriendLinks(body: string) {
  const friends: Friend[] = [], prose: string[] = []
  for (const token of marked.lexer(body)) {
    if (token.type === 'list' && !token.ordered) {
      const parsed = (token as Tokens.List).items.map(friend)
      // Preserve complex/mixed lists intact rather than dropping any editor content.
      if (parsed.length && parsed.every((entry): entry is Friend => entry !== null)) { friends.push(...parsed); continue }
    }
    prose.push(token.raw)
  }
  return { friends, prose:prose.join('') }
}

export function friendLinksContent(title: string, body: string, cfg: SiteConfig) {
  const {friends,prose} = parseFriendLinks(body), e = escape
  return `<style>
.friends-page{padding-top:2.5rem;padding-bottom:2rem;min-width:0}.friends-head{display:flex;align-items:center;gap:.75rem;margin-bottom:1rem}.friends-head h1{font-size:1.8rem;line-height:1.3}.friends-count{font-size:.75rem;color:var(--muted);border:1px solid var(--input-border);border-radius:6px;padding:.15rem .45rem;white-space:nowrap}.friends-intro{margin-bottom:1.5rem}.friends-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem;list-style:none;margin:0;padding:0}.friends-grid li{min-width:0}.friend-card{display:flex;flex-direction:column;gap:.9rem;height:100%;min-height:140px;padding:1.1rem;border:1px solid var(--input-border);border-radius:6px;color:var(--text);background:var(--surface);transition:border-color .15s,background-color .15s}.friend-card:hover{border-color:var(--muted);background:var(--bg-soft);opacity:1}.friend-card:focus-visible{outline:2px solid var(--text);outline-offset:3px}.friend-card-head{display:flex;align-items:center;gap:.8rem;min-width:0}.friend-icon{position:relative;display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border:1px solid var(--border);border-radius:6px;background:var(--bg-soft);overflow:hidden;font-size:1.1rem;font-weight:600;color:var(--muted)}.friend-icon img{position:absolute;inset:0;display:block;width:100%;height:100%;padding:5px;object-fit:contain;background:var(--surface)}.friend-icon img[hidden]{display:none}.friend-card-name{display:block;font-size:.98rem;font-weight:650;line-height:1.4;overflow-wrap:anywhere}.friend-card-host{display:block;font-size:.72rem;color:var(--muted);overflow-wrap:anywhere;margin-top:.15rem}.friend-card-description{font-size:.83rem;color:var(--muted);line-height:1.65;overflow-wrap:anywhere}.friends-info{margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--border)}.friends-info h2{font-size:1.15rem;margin-bottom:.65rem}.friends-info p{font-size:.88rem;color:var(--muted);line-height:1.7}.friends-info dl{display:grid;grid-template-columns:3rem minmax(0,1fr);gap:.55rem 1rem;font-size:.9rem;margin:1rem 0;line-height:1.7}.friends-info dt{color:var(--muted)}.friends-info dd{margin:0;overflow-wrap:anywhere}.friends-copy-status{min-height:1.5em;margin-top:.6rem}.friends-page .btn{font-size:.83rem}.friends-page [hidden]{display:none!important}@media(max-width:760px){.friends-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.friends-page{padding-top:1.5rem}.friends-head h1{font-size:1.55rem}.friends-grid{grid-template-columns:minmax(0,1fr);gap:.75rem}.friend-card{min-height:0;padding:1rem}}
</style><main class="wrap friends-page"><header class="friends-head"><h1>${e(title)}</h1><span class="friends-count">${friends.length} 个站点</span></header>${prose.trim() ? `<div class="article-body friends-intro" data-friend-markdown>${e(prose)}</div>` : ''}<ul class="friends-grid" aria-label="友情链接">${friends.map(item => `<li><a class="friend-card" href="${e(item.url)}" target="_blank" rel="noopener noreferrer"><div class="friend-card-head"><span class="friend-icon" aria-hidden="true"><span>${e(Array.from(item.name)[0] || '?')}</span><img src="${e(item.icon)}" alt="" width="44" height="44" loading="lazy" referrerpolicy="no-referrer"></span><span><span class="friend-card-name">${e(item.name)}</span><span class="friend-card-host">${e(item.host)}</span></span></div>${item.description ? `<p class="friend-card-description">${e(item.description)}</p>` : ''}</a></li>`).join('')}</ul><section class="friends-info" aria-labelledby="friends-info-title"><h2 id="friends-info-title">本站信息</h2><p>交换友链时，可以使用以下信息。</p><dl><dt>名称</dt><dd data-friend-site-name>${e(cfg.title)}</dd><dt>简介</dt><dd data-friend-site-description>${e(cfg.desc)}</dd><dt>网址</dt><dd><a data-friend-site-url href="/">本站首页</a></dd></dl><button class="btn" type="button" data-friend-copy hidden>复制本站信息</button><p class="friends-copy-status" data-friend-copy-status role="status" aria-live="polite"></p></section></main>`
}

export const FRIEND_LINKS_SCRIPT = `<script>${client}</script>`
