export type Post = { id: number; title: string; slug: string; body: string; published: number; created_at: string; ai_summary?: string | null }
export type PostActivityChanges = {
  published?: boolean
  title?: { before: string; after: string }
  body?: { removed: string; added: string; truncated: boolean }
}
export type PostActivity = { id: number; post_id: number; post_title: string; post_slug: string; event_type: 'published' | 'updated'; changes: PostActivityChanges; created_at: string }
export type Comment = { id: number; post_id: number; author: string; body: string; created_at: string; user_id: number | null }
export type SiteConfig = { title: string; desc: string; navLinks: { label: string; url: string }[] }
export type GiscusConfig = { repo: string; repoId: string; category: string; categoryId: string; mapping: string; strict: string; reactionsEnabled: string; emitMetadata: string; inputPosition: string; lang: string }
type UpdateItem = { title: string; url: string; createdAt: string }
export const DEFAULT_CONFIG: SiteConfig = { title: 'Blog', desc: '欢迎来到我的个人博客！这里记录着我的想法、学习和生活。', navLinks: [] }

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  color-scheme:light;
  --bg:#fff;
  --bg-soft:#f8f8f8;
  --surface:#fff;
  --text:#1a1a2e;
  --text-soft:#333;
  --muted:#666;
  --subtle:#999;
  --faint:#aaa;
  --border:#f0f0f0;
  --border-soft:#f5f5f5;
  --input-border:#e0e0e0;
  --code-bg:#f0f0f0;
  --pre-bg:#f6f8fa;
  --accent:#0066cc;
  --button-bg:#1a1a2e;
  --button-hover:#2d2d4e;
  --danger:#c00;
  --badge-bg:#eee;
  --badge-text:#666;
  --pub-bg:#d4edda;
  --pub-text:#155724;
  --hm-empty:#ebedf0;
  --hm-1:#9be9a8;
  --hm-2:#40c463;
  --hm-3:#30a14e;
  --hm-4:#216e39;
}
:root[data-theme="dark"]{
  color-scheme:dark;
  --bg:#111318;
  --bg-soft:#181b22;
  --surface:#151821;
  --text:#f2f4f8;
  --text-soft:#d8dde8;
  --muted:#a9b1c1;
  --subtle:#858fa2;
  --faint:#697386;
  --border:#292f3a;
  --border-soft:#242a34;
  --input-border:#394150;
  --code-bg:#222936;
  --pre-bg:#171c25;
  --accent:#7ab7ff;
  --button-bg:#e7edf7;
  --button-hover:#cfd9e8;
  --danger:#d94a4a;
  --badge-bg:#262d38;
  --badge-text:#b8c1d1;
  --pub-bg:#17351f;
  --pub-text:#a9e7b7;
  --hm-empty:#252b35;
  --hm-1:#245c35;
  --hm-2:#2f8b49;
  --hm-3:#45b965;
  --hm-4:#71d58d;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;transition:background-color .2s ease,color .2s ease}
a{color:inherit;text-decoration:none}
a:hover{opacity:.7}

/* nav */
.nav{display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;border-bottom:1px solid var(--border);position:sticky;top:0;background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:saturate(160%) blur(12px);z-index:100}
.nav-logo{font-size:1.2rem;font-weight:700;color:var(--text)}
.nav-links{display:flex;align-items:center;gap:1.5rem;font-size:.9rem;color:var(--muted)}
.nav-links a:hover{color:var(--text)}
.nav-icon{background:none;border:none;cursor:pointer;color:var(--muted);font-size:1rem;padding:.2rem;font-family:inherit}
.nav-icon:hover{color:var(--text)}
.subscribe-toggle{border:1px solid var(--input-border);border-radius:999px;padding:.25rem .75rem;background:var(--surface);color:var(--text);font-size:.86rem;line-height:1.2;cursor:pointer;font-family:inherit;white-space:nowrap}
.subscribe-toggle:hover{background:var(--bg-soft)}
.theme-toggle{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--input-border);border-radius:999px;padding:.22rem .5rem;line-height:1;background:var(--bg-soft);color:#000;min-width:2.3rem;min-height:1.55rem}
:root[data-theme="dark"] .theme-toggle{color:#fff}
.theme-toggle:hover{background:var(--surface);color:var(--text)}
.theme-icon{display:inline-block;position:relative;width:1rem;height:1rem;flex:0 0 auto}
.theme-icon.moon{border-radius:50%;background:#000}
.theme-icon.moon::after{content:"";position:absolute;top:-.08rem;left:.36rem;width:1rem;height:1rem;border-radius:50%;background:var(--bg-soft)}
.theme-toggle:hover .theme-icon.moon::after{background:var(--surface)}
.theme-icon.sun{width:.62rem;height:.62rem;margin:.19rem;border-radius:50%;background:#fff;box-shadow:0 -.43rem 0 -.22rem #fff,0 .43rem 0 -.22rem #fff,.43rem 0 0 -.22rem #fff,-.43rem 0 0 -.22rem #fff,.3rem .3rem 0 -.22rem #fff,-.3rem .3rem 0 -.22rem #fff,.3rem -.3rem 0 -.22rem #fff,-.3rem -.3rem 0 -.22rem #fff}

/* content */
.wrap{max-width:900px;margin:0 auto;padding:0 2rem}

/* hero */
.hero{padding:4rem 0 2rem}
.hero h1{font-size:2.8rem;font-weight:700;color:var(--text);margin-bottom:.75rem}
.hero-desc{color:var(--muted);font-size:1rem;line-height:1.6}
.cursor{display:inline-block;width:2px;height:1em;background:var(--text);margin-left:2px;vertical-align:middle;animation:blink 1s step-end infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

/* heatmap */
.heatmap-wrap{margin:2.5rem 0}
.heatmap-title{display:flex;justify-content:space-between;font-size:.8rem;color:var(--subtle);margin-bottom:.5rem}
.heatmap{display:grid;grid-template-columns:auto 1fr;gap:.25rem;align-items:start}
.hm-ylabels{display:flex;flex-direction:column;gap:2px;padding-top:18px;font-size:.7rem;color:var(--faint);width:1.5rem;text-align:right}
.hm-grid{overflow-x:auto}
.hm-months{display:grid;grid-auto-columns:10px;gap:2px;font-size:.7rem;color:var(--faint);margin-bottom:3px;min-height:12px}
.hm-month{white-space:nowrap}
.hm-cells{display:grid;grid-template-rows:repeat(7,10px);grid-auto-flow:column;grid-auto-columns:10px;gap:2px}
.hm-cell{display:block;width:10px;height:10px;border:0;border-radius:2px;padding:0;background:var(--hm-empty);font:inherit}
.hm-cell[data-date]{cursor:pointer}
.hm-cell[data-date]:hover,.hm-cell[data-date]:focus-visible{outline:1px solid var(--text);outline-offset:1px}
.hm-cell[aria-pressed="true"]{outline:2px solid var(--text);outline-offset:1px}
.hm-cell[data-l="1"]{background:var(--hm-1)}
.hm-cell[data-l="2"]{background:var(--hm-2)}
.hm-cell[data-l="3"]{background:var(--hm-3)}
.hm-cell[data-l="4"]{background:var(--hm-4)}
.hm-legend{display:flex;align-items:center;gap:4px;font-size:.75rem;color:var(--faint);justify-content:flex-end;margin-top:.5rem}
.hm-legend .hm-cell{display:inline-block}
.hm-year-button{background:none;border:none;cursor:pointer;font-size:.8rem;color:var(--faint);font-family:inherit}
.hm-year-button.active{color:var(--text);font-weight:700}
.hm-detail{margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)}
.hm-detail[hidden]{display:none}
.hm-detail-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.5rem}
.hm-detail-title{font-size:.92rem;font-weight:600;color:var(--text)}
.hm-detail-close{border:0;background:none;color:var(--muted);cursor:pointer;font-size:1rem;line-height:1;padding:.2rem}
.hm-empty-message{font-size:.88rem;color:var(--muted);padding:.5rem 0}
.hm-event{padding:.8rem 0;border-bottom:1px solid var(--border-soft)}
.hm-event:last-child{border-bottom:0}
.hm-event-head{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.55rem}
.hm-event-title{font-size:.92rem;font-weight:600;color:var(--text)}
.hm-event-type{font-size:.72rem;padding:.1rem .4rem;border-radius:3px;background:var(--badge-bg);color:var(--badge-text)}
.hm-event-time{font-size:.76rem;color:var(--faint);margin-left:auto}
.hm-publish-note,.hm-change-title{font-size:.84rem;color:var(--muted);line-height:1.6}
.hm-change-title del{color:var(--danger)}
.hm-change-title ins{color:var(--hm-3);text-decoration:none}
.hm-diff{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.55rem}
.hm-diff-block{min-width:0}
.hm-diff-label{display:block;font-size:.72rem;font-weight:600;margin-bottom:.25rem;color:var(--muted)}
.hm-diff-block.removed .hm-diff-label{color:var(--danger)}
.hm-diff-block.added .hm-diff-label{color:var(--hm-3)}
.hm-diff-block pre{margin:0;padding:.55rem .65rem;border-radius:4px;background:var(--pre-bg);font-size:.76rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;max-height:14rem;overflow:auto}
.hm-diff-note{font-size:.74rem;color:var(--faint);margin-top:.35rem}
@media(max-width:600px){.hm-diff{grid-template-columns:1fr}.hm-event-time{width:100%;margin-left:0}}

/* post list */
.post-list{margin:1rem 0}
.post-item{display:grid;grid-template-columns:90px 1fr;gap:1rem;padding:1.2rem 0;border-bottom:1px solid var(--border-soft);align-items:start}
.post-date{font-size:.82rem;color:var(--faint);padding-top:.15rem;font-variant-numeric:tabular-nums}
.post-title{font-size:1rem;font-weight:600;color:var(--text);margin-bottom:.3rem}
.post-title:hover{color:var(--accent)}
.post-excerpt{font-size:.88rem;color:var(--muted);line-height:1.5}

/* article */
.article{padding:2rem 0}
.article h1{font-size:2rem;font-weight:700;margin-bottom:.5rem}
.article-meta{color:var(--faint);font-size:.85rem;margin-bottom:2rem}
.article-body{line-height:1.8;font-size:1rem;color:var(--text-soft)}
.article-body h1,.article-body h2,.article-body h3{margin:1.5rem 0 .5rem;font-weight:600}
.article-body p{margin:.75rem 0}
.article-body pre{background:var(--pre-bg);padding:1rem;border-radius:6px;overflow-x:auto;margin:.75rem 0}
.article-body code{background:var(--code-bg);padding:.1rem .3rem;border-radius:3px;font-size:.9em}
.article-body pre code{background:none;padding:0}
.article-body blockquote{border-left:3px solid var(--input-border);padding-left:1rem;color:var(--muted);margin:.75rem 0}
.article-body ul,.article-body ol{padding-left:1.5rem;margin:.75rem 0}
.article-body img{max-width:100%;border-radius:6px}
.footnotes{margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.9rem;color:var(--muted)}
.footnotes ol{padding-left:1.3rem}
.footnotes li{margin:.4rem 0}
.footnotes p{display:inline}
.footnote-ref{font-size:.75em;vertical-align:super;line-height:0}
.footnote-ref a,.footnotes li{scroll-margin-top:5rem}
.footnote-backref{margin-left:.35rem;color:var(--accent)}
.spoiler{display:inline;cursor:pointer;border-radius:3px;filter:blur(5px);transition:filter .15s ease,background-color .15s ease;background:color-mix(in srgb,var(--text) 14%,transparent)}
.spoiler.revealed{filter:none;background:transparent}
.spoiler:focus{outline:1px solid var(--accent);outline-offset:2px}
.markdown-details{margin:.75rem 0}
.markdown-details summary{cursor:pointer;font-weight:600;color:var(--text);line-height:1.5}
.markdown-details-body{padding:.25rem 0 .25rem 1.25rem}
.markdown-details-body>:first-child{margin-top:.5rem}
.markdown-details-body>:last-child{margin-bottom:0}
.ai-summary-block{margin:1rem 0}
.ai-summary-box{margin-top:1rem;padding:.9rem 1.1rem;border:1px solid var(--input-border);border-left:3px solid var(--accent);border-radius:6px;background:var(--bg-soft)}
.ai-summary-label{display:inline-block;font-size:.78rem;font-weight:600;color:var(--accent);margin-bottom:.4rem;letter-spacing:.03em}
.ai-summary-text{font-size:.92rem;line-height:1.7;color:var(--text-soft)}

/* comments */
.comments{margin-top:3rem;border-top:1px solid var(--border);padding-top:2rem}
.comments h2{font-size:1.1rem;font-weight:600;margin-bottom:1.5rem}
.comments>h2:first-child{display:none}
.comments .giscus-title{display:block}
.giscus-frame{width:100%}
.comment{padding:.75rem 0;border-bottom:1px solid var(--border-soft)}
.comment-author{font-weight:600;font-size:.9rem}
.comment-date{color:var(--faint);font-size:.8rem;margin-left:.5rem}
.comment-body{margin-top:.3rem;font-size:.92rem;color:var(--text-soft);line-height:1.6}
.comment-form{margin-top:1.5rem}
.comment-form textarea{width:100%;padding:.75rem;border:1px solid var(--input-border);border-radius:6px;font-size:.9rem;font-family:inherit;resize:vertical;min-height:100px;outline:none;background:var(--surface);color:var(--text)}
.comment-form textarea:focus{border-color:var(--text)}
.auth-prompt{color:var(--muted);font-size:.9rem;margin-top:1rem}
.auth-prompt a{color:var(--text);text-decoration:underline}

/* forms */
.form-wrap{max-width:400px;margin:4rem auto;padding:0 2rem}
.form-wrap h1{font-size:1.5rem;font-weight:700;margin-bottom:1.5rem}
.form-group{display:flex;flex-direction:column;gap:.75rem}
.form-group input{padding:.65rem 1rem;border:1px solid var(--input-border);border-radius:6px;font-size:.95rem;outline:none;font-family:inherit;background:var(--surface);color:var(--text)}
.form-group input:focus{border-color:var(--text)}
.btn{padding:.65rem 1.5rem;background:var(--button-bg);color:var(--bg);border:none;border-radius:6px;font-size:.95rem;cursor:pointer;font-family:inherit}
.btn:hover{background:var(--button-hover)}
.btn-sm{padding:.3rem .8rem;font-size:.82rem}
.btn-danger{background:var(--danger);color:#fff}
.btn-ghost{background:none;color:var(--muted);border:1px solid var(--input-border)}
.btn-ghost:hover{background:var(--bg-soft);color:var(--text)}
.form-footer{margin-top:.75rem;font-size:.88rem;color:var(--muted)}
.form-footer a{color:var(--text);text-decoration:underline}
.error{color:var(--danger);font-size:.88rem;margin-bottom:.5rem}

/* admin */
.admin-wrap{max-width:900px;margin:0 auto;padding:2rem}
.admin-wrap h1{font-size:1.5rem;font-weight:700;margin-bottom:1.5rem}
table{width:100%;border-collapse:collapse;font-size:.9rem}
td,th{padding:.65rem .5rem;text-align:left;border-bottom:1px solid var(--border)}
th{font-weight:600;color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.05em}
.actions{display:flex;gap:.4rem;flex-wrap:wrap}
.badge{display:inline-block;padding:.15rem .5rem;border-radius:3px;font-size:.75rem;background:var(--badge-bg);color:var(--badge-text)}
.badge.pub{background:var(--pub-bg);color:var(--pub-text)}
.site-footer{text-align:center;padding:2rem;font-size:.82rem;color:var(--faint);border-top:1px solid var(--border);margin-top:3rem}
.update-toast{position:fixed;top:5rem;right:1rem;z-index:300;width:min(390px,calc(100vw - 2rem));display:none;padding:1.2rem 1.35rem 1.1rem;border:1px solid #fff;border-radius:8px;background:#3e3e3e;color:#fff;box-shadow:0 16px 42px rgba(0,0,0,.22)}
.update-toast.show{display:block}
.update-toast-head{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:1rem}
.update-toast h2{font-size:1.15rem;line-height:1.2;font-weight:700;color:#fff;margin:0}
.update-toast-close{border:none;background:none;color:#fff;font-size:1.25rem;line-height:1;cursor:pointer;padding:.1rem;font-family:inherit}
.update-toast-label{font-size:.86rem;font-weight:700;color:#fff;opacity:.72;margin-bottom:.35rem}
.update-toast-range{font-size:.82rem;color:#fff;opacity:.58;margin-bottom:1.1rem}
.update-toast-main{display:flex;align-items:center;justify-content:space-between;gap:1rem}
.update-toast-title{min-width:0;color:#fff;font-size:1rem;font-weight:700;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.update-toast-action{border:none;border-radius:5px;background:#fff;color:#000;padding:.35rem .65rem;font-size:.86rem;line-height:1;cursor:pointer;font-family:inherit;white-space:nowrap}
.update-toast-action:hover{opacity:.86}
[style*="color:#888"],[style*="color: #888"]{color:var(--subtle)!important}
[style*="color:#aaa"],[style*="color: #aaa"]{color:var(--faint)!important}
[style*="color:#555"],[style*="color: #555"]{color:var(--muted)!important}
[style*="border-bottom:1px solid #f0f0f0"],[style*="border-bottom: 1px solid #f0f0f0"]{border-bottom-color:var(--border)!important}
`

export function layout(title: string, body: string, adminNav = false, loggedInUsername?: string | null, cfg: SiteConfig = DEFAULT_CONFIG, updates: UpdateItem[] = []): string {
  const extraLinks = cfg.navLinks.map(l => `<a href="${esc(l.url)}">${esc(l.label)}</a>`).join('')
  const subscribeToggle = `<button class="subscribe-toggle" type="button" id="subscribe-toggle" aria-pressed="false">订阅</button>`
  const themeToggle = `<button class="nav-icon theme-toggle" type="button" id="theme-toggle" aria-label="切换夜间模式" aria-pressed="false" title="切换夜间模式"><span class="theme-icon moon" aria-hidden="true"></span></button>`
  const updateJson = JSON.stringify(updates)
  const rightNav = adminNav
    ? `<div class="nav-links"><a href="/admin">管理</a><a href="/admin/post/new">新建</a><a href="/admin/settings">设置</a>${themeToggle}<form method="post" action="/admin/logout" style="display:inline"><button class="nav-icon">退出</button></form></div>`
    : loggedInUsername
      ? `<div class="nav-links">${extraLinks}<span>${esc(loggedInUsername)}</span>${subscribeToggle}${themeToggle}<form method="post" action="/logout-user" style="display:inline"><button class="nav-icon">退出</button></form></div>`
      : `<div class="nav-links">${extraLinks}<a href="/login">登录</a><a href="/register">注册</a>${subscribeToggle}${themeToggle}</div>`
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="alternate" type="application/rss+xml" title="${esc(cfg.title)} RSS" href="/rss.xml"><title>${title} — ${esc(cfg.title)}</title><script>
(function(){
  var saved=localStorage.getItem('theme');
  var systemDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme=saved||(systemDark?'dark':'light');
})();
</script><link href="https://cdn.quilljs.com/1.3.7/quill.snow.css" rel="stylesheet"><style>${BASE_CSS}</style></head><body>
<nav class="nav"><a href="/" class="nav-logo">${esc(cfg.title)}</a>${rightNav}</nav>
${body}
<div class="update-toast" id="update-toast" role="dialog" aria-live="polite" aria-label="发现新文章">
  <div class="update-toast-head">
    <h2>发现新文章</h2>
    <button class="update-toast-close" type="button" id="update-toast-close" aria-label="关闭">×</button>
  </div>
  <div class="update-toast-label">发现更新</div>
  <div class="update-toast-range" id="update-toast-range"></div>
  <div class="update-toast-main">
    <a class="update-toast-title" id="update-toast-title" href="/"></a>
    <button class="update-toast-action" type="button" id="update-toast-action">更新</button>
  </div>
</div>
<footer class="site-footer">
<script>document.write('© 2026' + (new Date().getFullYear()>2026 ? '~'+new Date().getFullYear() : '') + ' hekuo')</script>
<div style="margin-top:.5rem;display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap"><a href="/terms">用户协议</a><a href="/privacy">隐私协议</a></div>
</footer>
<script id="update-data" type="application/json">${updateJson.replace(/</g, '\\u003c')}</script>
<script>
(function(){
  var btn=document.getElementById('theme-toggle');
  if(!btn)return;
  var icon=btn.querySelector('.theme-icon');
  function sync(){
    var dark=document.documentElement.dataset.theme==='dark';
    if(icon) icon.className='theme-icon '+(dark?'sun':'moon');
    btn.setAttribute('aria-label',dark?'切换日间模式':'切换夜间模式');
    btn.setAttribute('title',dark?'切换日间模式':'切换夜间模式');
    btn.setAttribute('aria-pressed',String(dark));
  }
  btn.addEventListener('click',function(){
    var next=document.documentElement.dataset.theme==='dark'?'light':'dark';
    document.documentElement.dataset.theme=next;
    localStorage.setItem('theme',next);
    sync();
  });
  sync();
})();
</script>
<script>
(function(){
  var cookieName='blog_subscribed_at';
  var subBtn=document.getElementById('subscribe-toggle');
  var toast=document.getElementById('update-toast');
  var closeBtn=document.getElementById('update-toast-close');
  var titleEl=document.getElementById('update-toast-title');
  var rangeEl=document.getElementById('update-toast-range');
  var actionBtn=document.getElementById('update-toast-action');
  function getCookie(name){
    return document.cookie.split('; ').reduce(function(found,part){
      if(found)return found;
      var eq=part.indexOf('=');
      return part.slice(0,eq)===name?decodeURIComponent(part.slice(eq+1)):'';
    },'');
  }
  function setCookie(value){
    document.cookie=cookieName+'='+encodeURIComponent(value)+'; Max-Age=31536000; Path=/; SameSite=Lax';
  }
  function clearCookie(){
    document.cookie=cookieName+'=; Max-Age=0; Path=/; SameSite=Lax';
  }
  function toTime(value){
    if(!value)return NaN;
    var normalized=/^\d{4}-\d{2}-\d{2} \d{2}:/.test(value)?value.replace(' ','T')+'Z':value;
    return new Date(normalized).getTime();
  }
  function formatTime(value){
    var time=toTime(value);
    if(!Number.isFinite(time))return value;
    var d=new Date(time);
    var pad=function(n){return String(n).padStart(2,'0')};
    return d.getFullYear()+'/'+pad(d.getMonth()+1)+'/'+pad(d.getDate())+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());
  }
  function syncButton(){
    if(!subBtn)return;
    var subscribed=!!getCookie(cookieName);
    subBtn.textContent=subscribed?'取消订阅':'订阅';
    subBtn.setAttribute('aria-pressed',String(subscribed));
  }
  function showToast(item, since){
    if(!toast||!titleEl||!rangeEl||!actionBtn)return;
    titleEl.textContent=item.title;
    titleEl.href=item.url;
    rangeEl.textContent=formatTime(since)+' - '+formatTime(item.createdAt);
    actionBtn.onclick=function(){ window.location.href=item.url; };
    toast.classList.add('show');
  }
  function loadUpdates(){
    return fetch('/rss.xml',{headers:{Accept:'application/rss+xml'}})
      .then(function(res){return res.ok?res.text():''})
      .then(function(xml){
        if(!xml)return [];
        var doc=new DOMParser().parseFromString(xml,'application/xml');
        if(doc.querySelector('parsererror'))return [];
        return Array.prototype.map.call(doc.querySelectorAll('channel > item'),function(item){
          var title=item.querySelector('title');
          var link=item.querySelector('link');
          var date=item.querySelector('pubDate');
          return {
            title:title?title.textContent||'':'',
            url:link?link.textContent||'/':'/',
            createdAt:date?date.textContent||'':''
          };
        });
      })
      .catch(function(){return []});
  }
  function checkUpdates(){
    var subscribedAt=getCookie(cookieName);
    var subscribedTime=toTime(subscribedAt);
    if(!Number.isFinite(subscribedTime))return;
    loadUpdates().then(function(items){
      var newer=items.filter(function(item){return toTime(item.createdAt)>subscribedTime})
        .sort(function(a,b){return toTime(b.createdAt)-toTime(a.createdAt)});
      if(!newer.length)return;
      showToast(newer[0],subscribedAt);
      setCookie(newer[0].createdAt);
      syncButton();
    });
  }
  if(subBtn){
    subBtn.addEventListener('click',function(){
      if(getCookie(cookieName)){
        clearCookie();
      }else{
        setCookie(new Date().toISOString());
      }
      syncButton();
    });
  }
  if(closeBtn&&toast){
    closeBtn.addEventListener('click',function(){toast.classList.remove('show')});
  }
  syncButton();
  checkUpdates();
})();
</script>
</body></html>`
}

function excerpt(md: string, len = 120): string {
  const text = md
    .replace(/\[\/?ai-summary\]/gi, '')
    .replace(/[#*`_\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return esc(text.slice(0, len)) + (text.length > len ? '…' : '')
}

const MARKDOWN_SCRIPT = `<script>
(function(){
  if(window.renderMarkdown)return;
  function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  var renderId=0;
  window.renderMarkdown=function(md){
    var notes=[];
    var spoilers=[];
    var details=[];
    var prefix='md-'+(++renderId);
    var text=String(md||'').replace(/\\[details\\s*=\\s*"([^"]*)"\\]([\\s\\S]*?)\\[\\/details\\]/gi,function(_,title,body){
      var index=details.length;
      details.push({title:title,body:body});
      return '\\n\\n@@DETAILS_'+index+'@@\\n\\n';
    });
    text=text.replace(/\\[spoiler\\]([\\s\\S]*?)\\[\\/spoiler\\]/gi,function(_,body){
      var index=spoilers.length;
      spoilers.push(body);
      return '@@SPOILER_'+index+'@@';
    });
    text=text.replace(/\\^\\[([^\\]]+)\\]/g,function(_,body){
      notes.push(body);
      var number=notes.length;
      var refId=prefix+'-fnref-'+number;
      var noteId=prefix+'-fn-'+number;
      return '<sup class="footnote-ref"><a id="'+refId+'" href="#'+noteId+'" data-footnote-ref aria-describedby="'+prefix+'-footnote-label">'+number+'</a></sup>';
    });
    var html=marked.parse(text,{breaks:true});
    html=html.replace(/@@SPOILER_(\\d+)@@/g,function(_,index){
      var body=spoilers[Number(index)]||'';
      var rendered=marked.parseInline?marked.parseInline(body):marked.parse(body,{breaks:true});
      return '<span class="spoiler" role="button" tabindex="0" aria-label="点击显示隐藏内容" onclick="this.classList.add(\\'revealed\\')" onkeydown="if(event.key===\\'Enter\\'||event.key===\\' \\'){event.preventDefault();this.classList.add(\\'revealed\\')}">'+rendered+'</span>';
    });
    function renderDetails(index){
      var item=details[Number(index)]||{title:'',body:''};
      return '<details class="markdown-details"><summary>'+escHtml(item.title)+'</summary><div class="markdown-details-body">'+window.renderMarkdown(item.body.trim())+'</div></details>';
    }
    html=html.replace(/<p>@@DETAILS_(\\d+)@@<\\/p>/g,function(_,index){return renderDetails(index);});
    html=html.replace(/@@DETAILS_(\\d+)@@/g,function(_,index){return renderDetails(index);});
    if(!notes.length)return html;
    var items=notes.map(function(body,index){
      var number=index+1;
      return '<li id="'+prefix+'-fn-'+number+'">'+marked.parse(body,{breaks:true})+' <a class="footnote-backref" href="#'+prefix+'-fnref-'+number+'" aria-label="返回脚注引用位置">↩</a></li>';
    }).join('');
    return html+'<section class="footnotes" data-footnotes><h2 id="'+prefix+'-footnote-label" style="position:absolute;left:-9999px">脚注</h2><ol>'+items+'</ol></section>';
  };
})();
</script>`

function updateItems(posts: Post[]): UpdateItem[] {
  return posts.map(p => ({ title: p.title, url: `/post/${p.slug}`, createdAt: p.created_at }))
}

function editorWidget(title: string, body: string, hasSlug: boolean): string {
  const safeBody = body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const titleField = hasSlug
    ? `<input class="pf-input" name="title" placeholder="标题" required value="${esc(title)}" style="margin-bottom:.5rem">`
    : `<input class="pf-input" name="title" placeholder="标题" required value="${esc(title)}" style="margin-bottom:.5rem">`
  return `<style>
.pf-input{padding:.65rem 1rem;border:1px solid var(--input-border);border-radius:6px;font-size:.95rem;outline:none;font-family:inherit;width:100%;background:var(--surface);color:var(--text)}
.pf-input:focus{border-color:var(--text)}
.editor-wrap{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--input-border);border-radius:6px;overflow:hidden;height:500px;background:var(--surface)}
.editor-pane{display:flex;flex-direction:column}
.editor-pane textarea{flex:1;padding:.75rem;border:none;border-right:1px solid var(--input-border);font-family:'SFMono-Regular',Consolas,monospace;font-size:.88rem;resize:none;outline:none;line-height:1.6;background:var(--surface);color:var(--text)}
.preview-pane{overflow-y:auto;padding:.75rem 1rem;font-size:.95rem;line-height:1.7;color:var(--text-soft);background:var(--bg)}
.preview-pane h1,.preview-pane h2,.preview-pane h3{margin:1rem 0 .4rem;font-weight:600}
.preview-pane p{margin:.5rem 0}
.preview-pane pre{background:var(--pre-bg);padding:.75rem;border-radius:4px;overflow-x:auto}
.preview-pane code{background:var(--code-bg);padding:.1rem .3rem;border-radius:3px;font-size:.88em}
.preview-pane pre code{background:none;padding:0}
.preview-pane blockquote{border-left:3px solid var(--input-border);padding-left:.75rem;color:var(--muted)}
.preview-pane ul,.preview-pane ol{padding-left:1.5rem}
.editor-bar{display:flex;align-items:center;justify-content:space-between;padding:.3rem .75rem;background:var(--bg-soft);border-bottom:1px solid var(--input-border);font-size:.78rem;color:var(--subtle)}
.image-upload-status{color:var(--muted)}
</style>
${titleField}
<div class="editor-wrap">
  <div class="editor-pane">
    <div class="editor-bar"><span>Markdown</span><span class="image-upload-status" id="image-upload-status"></span></div>
    <textarea id="md-src" name="body" placeholder="# 标题&#10;&#10;正文内容…">${safeBody}</textarea>
  </div>
  <div class="preview-pane" id="md-prev"></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
${MARKDOWN_SCRIPT}
<script>
(function(){
const src=document.getElementById('md-src'),prev=document.getElementById('md-prev'),status=document.getElementById('image-upload-status');
function render(){prev.innerHTML=window.renderMarkdown(src.value||'');}
function setStatus(text){if(status)status.textContent=text||'';}
function insertText(text){
  const start=src.selectionStart||0,end=src.selectionEnd||0;
  src.value=src.value.slice(0,start)+text+src.value.slice(end);
  const pos=start+text.length;
  src.setSelectionRange(pos,pos);
  src.focus();
  render();
}
async function uploadImage(file){
  const fd=new FormData();
  fd.append('image',file);
  setStatus('上传图片中...');
  const res=await fetch('/admin/images',{method:'POST',body:fd});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||!data.url)throw new Error(data.error||'upload failed');
  return data.url;
}
src.addEventListener('paste',async function(e){
  const files=[...((e.clipboardData&&e.clipboardData.files)||[])].filter(f=>f.type&&f.type.startsWith('image/'));
  if(!files.length)return;
  e.preventDefault();
  try{
    for(const file of files){
      const url=await uploadImage(file);
      insertText('\\n![image]('+url+')\\n');
    }
    setStatus('图片已上传');
    setTimeout(()=>setStatus(''),1600);
  }catch(err){
    setStatus('图片上传失败');
  }
});
src.addEventListener('input',render);
render();
})();
</script>`
}

function heatmap(activities: PostActivity[]): string {
  const activitiesJson = JSON.stringify(activities).replace(/</g, '\\u003c')
  return `<div class="heatmap-wrap">
<div class="heatmap-title">
  <span>文章发布与修改</span>
  <span id="hm-year-nav" style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap"></span>
</div>
<div class="heatmap">
  <div class="hm-ylabels"><span></span><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span></div>
  <div class="hm-grid">
    <div class="hm-months" id="hm-months"></div>
    <div class="hm-cells" id="hm-cells"></div>
  </div>
</div>
<div class="hm-legend">少 <span class="hm-cell" data-l="0"></span><span class="hm-cell" data-l="1"></span><span class="hm-cell" data-l="2"></span><span class="hm-cell" data-l="3"></span><span class="hm-cell" data-l="4"></span> 多</div>
<div class="hm-detail" id="hm-detail" hidden>
  <div class="hm-detail-head"><h2 class="hm-detail-title" id="hm-detail-title"></h2><button class="hm-detail-close" id="hm-detail-close" type="button" title="关闭" aria-label="关闭">×</button></div>
  <div id="hm-detail-events"></div>
</div>
</div>
<script>
(function(){
const activities=${activitiesJson};
const MONTHS=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const byDate={};
activities.forEach(item=>{const key=item.created_at.slice(0,10);(byDate[key]||(byDate[key]=[])).push(item)});
const activityYears=Object.keys(byDate).map(d=>d.slice(0,4));
const allYears=[...new Set([...activityYears,String(new Date().getFullYear())])].sort();
let curYear=Number(allYears[allYears.length-1]);

function h(value){
  return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function keyOf(date){
  const pad=n=>String(n).padStart(2,'0');
  return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate());
}
function level(count){return count===0?0:count===1?1:count<=3?2:count<=5?3:4}
function diffBlock(kind,label,value){
  return '<div class="hm-diff-block '+kind+'"><span class="hm-diff-label">'+label+'</span><pre>'+h(value||'（无）')+'</pre></div>';
}
function eventHtml(item){
  const changes=item.changes||{};
  const type=item.event_type==='published'?'发布':'修改';
  const time=item.created_at.length>=16?item.created_at.slice(11,16):'';
  let detail='';
  if(item.event_type==='published') detail='<p class="hm-publish-note">文章在这一天发布。</p>';
  if(changes.title){
    detail+='<p class="hm-change-title"><strong>标题：</strong><del>'+h(changes.title.before)+'</del> → <ins>'+h(changes.title.after)+'</ins></p>';
  }
  if(changes.body){
    detail+='<div class="hm-diff">'+diffBlock('removed','删除',changes.body.removed)+diffBlock('added','新增',changes.body.added)+'</div>';
    if(changes.body.truncated) detail+='<p class="hm-diff-note">改动较长，仅显示开头和结尾。</p>';
  }
  return '<article class="hm-event"><div class="hm-event-head"><a class="hm-event-title" href="/post/'+encodeURIComponent(item.post_slug)+'">'+h(item.post_title)+'</a><span class="hm-event-type">'+type+'</span><time class="hm-event-time">'+h(time)+'</time></div>'+detail+'</article>';
}
function showDate(key,button){
  document.querySelectorAll('#hm-cells [aria-pressed="true"]').forEach(cell=>cell.setAttribute('aria-pressed','false'));
  if(button)button.setAttribute('aria-pressed','true');
  const items=byDate[key]||[];
  const detail=document.getElementById('hm-detail');
  document.getElementById('hm-detail-title').textContent=key+' · '+items.length+' 次活动';
  document.getElementById('hm-detail-events').innerHTML=items.length?items.map(eventHtml).join(''):'<p class="hm-empty-message">当天没有文章发布或修改。</p>';
  detail.hidden=false;
}
function render(year){
  const first=new Date(year,0,1);
  const gridStart=new Date(year,0,1-first.getDay());
  const last=new Date(year,11,31);
  const totalWeeks=Math.floor((last-gridStart)/86400000/7)+1;
  const cells=[];
  for(let w=0;w<totalWeeks;w++){
    for(let d=0;d<7;d++){
      const date=new Date(gridStart);
      date.setDate(gridStart.getDate()+w*7+d);
      if(date.getFullYear()!==year){cells.push('<span class="hm-cell" aria-hidden="true"></span>');continue;}
      const key=keyOf(date), count=(byDate[key]||[]).length;
      cells.push('<button class="hm-cell" type="button" data-date="'+key+'" data-l="'+level(count)+'" aria-label="'+key+'，'+count+' 次活动" aria-pressed="false" title="'+key+': '+count+'"></button>');
    }
  }
  const cellsEl=document.getElementById('hm-cells');
  cellsEl.style.gridTemplateColumns='repeat('+totalWeeks+',10px)';
  cellsEl.innerHTML=cells.join('');
  cellsEl.querySelectorAll('[data-date]').forEach(cell=>cell.addEventListener('click',()=>showDate(cell.dataset.date,cell)));

  const monthLabels=MONTHS.map((label,index)=>{
    const date=new Date(year,index,1);
    const week=Math.floor((date-gridStart)/86400000/7);
    return '<span class="hm-month" style="grid-column:'+(week+1)+'/span 4">'+label+'</span>';
  });
  const monthsEl=document.getElementById('hm-months');
  monthsEl.style.gridTemplateColumns='repeat('+totalWeeks+',10px)';
  monthsEl.innerHTML=monthLabels.join('');

  const nav=document.getElementById('hm-year-nav');
  nav.innerHTML=allYears.map(y=>'<button class="hm-year-button '+(Number(y)===year?'active':'')+'" type="button" data-year="'+y+'">'+y+'</button>').join('');
  nav.querySelectorAll('[data-year]').forEach(button=>button.addEventListener('click',()=>{curYear=Number(button.dataset.year);render(curYear)}));
  document.getElementById('hm-detail').hidden=true;
}
document.getElementById('hm-detail-close').addEventListener('click',()=>{
  document.getElementById('hm-detail').hidden=true;
  document.querySelectorAll('#hm-cells [aria-pressed="true"]').forEach(cell=>cell.setAttribute('aria-pressed','false'));
});
render(curYear);
})();
</script>`
}

export function postList(posts: Post[], activities: PostActivity[], loggedInUsername?: string | null, cfg: SiteConfig = DEFAULT_CONFIG): string {
  const items = posts.length
    ? posts.map(p => `<div class="post-item">
  <div class="post-date">${p.created_at.slice(0, 10)}</div>
  <div><a href="/post/${p.slug}" class="post-title">${esc(p.title)}</a><div class="post-excerpt">${excerpt(p.body)}</div></div>
</div>`).join('')
    : '<p style="color:#aaa;padding:2rem 0">暂无文章</p>'

  const body = `<div class="wrap">
<div class="hero"><h1>${esc(cfg.title)}<span class="cursor"></span></h1><p class="hero-desc">${esc(cfg.desc)}</p></div>
${heatmap(activities)}
<div class="post-list">${items}</div>
</div>` 
  return layout(cfg.title, body, false, loggedInUsername, cfg, updateItems(posts))
}

export function postDetail(post: Post, comments: Comment[], loggedInUsername: string | null, cfg: SiteConfig = DEFAULT_CONFIG, giscus?: GiscusConfig | null): string {
  const commentList = comments.map(c =>
    `<div class="comment"><span class="comment-author">${esc(c.author)}</span><span class="comment-date">${c.created_at.slice(0, 10)}</span><div class="comment-body">${esc(c.body)}</div></div>`
  ).join('')
  const commentForm = loggedInUsername
    ? `<div class="comment-form"><form method="post" action="/post/${post.slug}/comment">
  <textarea name="body" placeholder="写下你的评论…" required maxlength="1000"></textarea>
  <br><button class="btn btn-sm" style="margin-top:.5rem" type="submit">提交</button>
</form></div>`
    : `<p class="auth-prompt"><a href="/login">登录</a> 或 <a href="/register">注册</a> 后发表评论</p>`

  let summaries: string[] = []
  try { const a = post.ai_summary ? JSON.parse(post.ai_summary) : []; summaries = Array.isArray(a) ? a.map((s: any) => typeof s === 'string' ? s : '') : [] } catch { summaries = [] }
  const giscusComments = giscusWidget(giscus)

  const body = `<div class="wrap"><div class="article">
<h1>${esc(post.title)}</h1>
<div class="article-meta">${post.created_at.slice(0, 10)}</div>
<div class="article-body" id="post-body"></div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
${MARKDOWN_SCRIPT}
<script>
(function(){
var raw=${JSON.stringify(post.body)};
var summaries=${JSON.stringify(summaries)};
var re=/\\[ai-summary\\]([\\s\\S]*?)\\[\\/ai-summary\\]/g;
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
var out='',last=0,m,i=0;
while((m=re.exec(raw))!==null){
  out+=window.renderMarkdown(raw.slice(last,m.index));
  var summary=summaries[i++];
  out+='<div class="ai-summary-block">'+window.renderMarkdown(m[1]);
  if(summary){out+='<div class="ai-summary-box"><span class="ai-summary-label">AI 总结</span><div class="ai-summary-text">'+esc(summary)+'</div></div>';}
  out+='</div>';
  last=m.index+m[0].length;
}
out+=window.renderMarkdown(raw.slice(last));
document.getElementById('post-body').innerHTML=out;
})();
</script>
<div class="comments">
  <h2>评论 (${comments.length})</h2>
  ${giscusComments}
</div>
</div></div>`
  return layout(post.title, body, false, loggedInUsername, cfg)
}

function giscusWidget(cfg?: GiscusConfig | null): string {
  if (!cfg || !cfg.repo || !cfg.repoId || !cfg.category || !cfg.categoryId) {
    return `<h2 class="giscus-title">评论</h2><p class="auth-prompt">Giscus 尚未配置。请设置 GISCUS_REPO_ID、GISCUS_CATEGORY 和 GISCUS_CATEGORY_ID。</p>`
  }
  return `<h2 class="giscus-title">评论</h2>
<script src="https://giscus.app/client.js"
  data-repo="${esc(cfg.repo)}"
  data-repo-id="${esc(cfg.repoId)}"
  data-category="${esc(cfg.category)}"
  data-category-id="${esc(cfg.categoryId)}"
  data-mapping="${esc(cfg.mapping)}"
  data-strict="${esc(cfg.strict)}"
  data-reactions-enabled="${esc(cfg.reactionsEnabled)}"
  data-emit-metadata="${esc(cfg.emitMetadata)}"
  data-input-position="${esc(cfg.inputPosition)}"
  data-theme="preferred_color_scheme"
  data-lang="${esc(cfg.lang)}"
  crossorigin="anonymous"
  async></script>
<script>
(function(){
  function sendTheme(){
    var frame=document.querySelector('iframe.giscus-frame');
    if(!frame)return;
    var theme=document.documentElement.dataset.theme==='dark'?'dark':'light';
    frame.contentWindow.postMessage({giscus:{setConfig:{theme:theme}}},'https://giscus.app');
  }
  var observer=new MutationObserver(sendTheme);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  setTimeout(sendTheme,800);
})();
</script>`
}

export function loginPage(error?: string): string {
  return layout('管理员登录', `<div class="form-wrap"><h1>管理员登录</h1>${error ? `<p class="error">${esc(error)}</p>` : ''}
<form method="post" action="/admin/login" class="form-group">
  <input name="username" placeholder="用户名" required autocomplete="username">
  <input name="password" type="password" placeholder="密码" required autocomplete="current-password">
  <button class="btn" type="submit">登录</button>
</form></div>`)
}

export function userLoginPage(error?: string): string {
  return layout('登录', `<div class="form-wrap"><h1>登录</h1>${error ? `<p class="error">${esc(error)}</p>` : ''}
<form method="post" action="/login" class="form-group">
  <input name="username" placeholder="用户名" required autocomplete="username">
  <input name="password" type="password" placeholder="密码" required autocomplete="current-password">
  <button class="btn" type="submit">登录</button>
</form><p class="form-footer">没有账号？<a href="/register">注册</a></p></div>`)
}

export function registerPage(error?: string): string {
  return layout('注册', `<div class="form-wrap"><h1>注册</h1>${error ? `<p class="error">${esc(error)}</p>` : ''}
<form method="post" action="/register" class="form-group">
  <input name="username" placeholder="用户名" required maxlength="30">
  <input name="password" type="password" placeholder="密码（至少6位）" required minlength="6">
  <button class="btn" type="submit">注册</button>
</form><p class="form-footer">已有账号？<a href="/login">登录</a></p></div>`)
}

export function adminDashboard(posts: Post[]): string {
  const rows = posts.map(p => `<tr>
<td>${esc(p.title)}</td>
<td><span class="badge ${p.published ? 'pub' : ''}">${p.published ? '已发布' : '草稿'}</span></td>
<td style="color:#aaa;font-size:.82rem">${p.created_at.slice(0, 10)}</td>
<td class="actions">
  <a href="/admin/post/${p.id}/edit"><button class="btn btn-sm btn-ghost">编辑</button></a>
  <form method="post" action="/admin/post/${p.id}/publish" style="display:inline"><button class="btn btn-sm btn-ghost">${p.published ? '取消' : '发布'}</button></form>
  <form method="post" action="/admin/post/${p.id}/delete" style="display:inline" onsubmit="return confirm('确认删除？')"><button class="btn btn-sm btn-danger">删除</button></form>
</td></tr>`).join('')
  return layout('文章管理', `<div class="admin-wrap">
<div style="display:flex;gap:.75rem;margin-bottom:1.5rem;border-bottom:1px solid #f0f0f0;padding-bottom:.75rem">
  <a href="/admin"><strong>文章</strong></a>
  <a href="/admin/pages" style="color:#888">页面</a>
  <a href="/admin/settings" style="color:#888">设置</a>
</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
  <h1>文章</h1><a href="/admin/post/new"><button class="btn btn-sm">新建文章</button></a>
</div>
<table><thead><tr><th>标题</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`, true)
}

export type PageItem = { id: number; title: string; slug: string; body: string; published: number; created_at: string }

export function adminPageDashboard(pages: PageItem[]): string {
  const rows = pages.map(p => `<tr>
<td>${esc(p.title)}</td>
<td><a href="/p/${esc(p.slug)}" style="color:#888;font-size:.82rem">/${p.slug}</a></td>
<td><span class="badge ${p.published ? 'pub' : ''}">${p.published ? '已发布' : '草稿'}</span></td>
<td class="actions">
  <a href="/admin/page/${p.id}/edit"><button class="btn btn-sm btn-ghost">编辑</button></a>
  <form method="post" action="/admin/page/${p.id}/publish" style="display:inline"><button class="btn btn-sm btn-ghost">${p.published ? '取消' : '发布'}</button></form>
  <form method="post" action="/admin/page/${p.id}/delete" style="display:inline" onsubmit="return confirm('确认删除？')"><button class="btn btn-sm btn-danger">删除</button></form>
</td></tr>`).join('')
  return layout('页面管理', `<div class="admin-wrap">
<div style="display:flex;gap:.75rem;margin-bottom:1.5rem;border-bottom:1px solid #f0f0f0;padding-bottom:.75rem">
  <a href="/admin" style="color:#888">文章</a>
  <a href="/admin/pages"><strong>页面</strong></a>
  <a href="/admin/settings" style="color:#888">设置</a>
</div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
  <h1>页面</h1><a href="/admin/page/new"><button class="btn btn-sm">新建页面</button></a>
</div>
<table><thead><tr><th>标题</th><th>路径</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`, true)
}

export function pageDetail(page: PageItem, cfg: SiteConfig = DEFAULT_CONFIG, loggedInUsername?: string | null): string {
  const body = `<div class="wrap"><div class="article">
<h1>${esc(page.title)}</h1>
<div class="article-body" id="post-body"></div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
${MARKDOWN_SCRIPT}
<script>document.getElementById('post-body').innerHTML=window.renderMarkdown(${JSON.stringify(page.body)});</script>
</div></div>`
  return layout(page.title, body, false, loggedInUsername, cfg)
}

export function pageForm(page?: PageItem): string {
  const action = page ? `/admin/page/${page.id}` : '/admin/page'
  return layout(page ? '编辑页面' : '新建页面', `<div class="admin-wrap"><h1>${page ? '编辑页面' : '新建页面'}</h1>
<form method="post" action="${action}" id="pf">
  ${editorWidget(page?.title ?? '', page?.body ?? '', true)}
  <input name="slug" class="pf-input" placeholder="路径 slug（如 about）" required value="${page ? esc(page.slug) : ''}" style="margin-top:.5rem">
  <div style="margin-top:.75rem"><button class="btn" type="submit">保存</button></div>
</form></div>`, true)
}

export function termsPage(cfg: SiteConfig = DEFAULT_CONFIG, loggedInUsername?: string | null): string {
  return legalPage('用户协议', `<h2>一、服务说明</h2>
<p>本博客提供文章阅读、页面浏览、订阅提醒以及基于 Giscus 的评论互动功能。访问或使用本网站，即表示你已阅读并同意本协议。</p>
<h2>二、账号与评论</h2>
<p>评论服务由 Giscus 基于 GitHub Discussions 提供。你发布评论时，需要遵守 GitHub 的相关条款，也需要对自己发布的内容负责。</p>
<h2>三、内容使用</h2>
<p>除非页面另有说明，本博客原创内容归作者所有。未经许可，请勿将文章用于商业转载、批量采集或误导性再发布。</p>
<h2>四、禁止行为</h2>
<p>请勿发布违法、侵权、骚扰、垃圾广告、恶意代码、自动化滥用或破坏网站正常运行的内容。</p>
<h2>五、免责声明</h2>
<p>博客内容主要用于个人记录与交流，不构成专业建议。因使用本站内容产生的判断和后果，由使用者自行承担。</p>
<h2>六、协议变更</h2>
<p>本协议可能随网站功能调整而更新，更新后会在本页面公布。</p>`, cfg, loggedInUsername)
}

export function privacyPage(cfg: SiteConfig = DEFAULT_CONFIG, loggedInUsername?: string | null): string {
  return legalPage('隐私协议', `<h2>一、我们收集的信息</h2>
<p>本站可能保存账号登录所需的会话 Cookie、订阅提醒 Cookie、访问请求产生的基础日志，以及你主动提交的内容。</p>
<h2>二、第三方评论</h2>
<p>评论区使用 Giscus。加载和使用评论功能时，GitHub/Giscus 可能按照其隐私政策处理你的 GitHub 账号信息、评论内容、设备与网络信息。</p>
<h2>三、信息用途</h2>
<p>这些信息用于维持登录状态、提供订阅提醒、展示评论、排查故障、保障网站安全和改进内容体验。</p>
<h2>四、Cookie</h2>
<p>本站使用 Cookie 保存登录会话和订阅状态。你可以在浏览器中清除 Cookie，但相关功能可能需要重新登录或重新订阅。</p>
<h2>五、数据安全</h2>
<p>我们会采取合理措施保护数据，但互联网传输和第三方服务无法保证绝对安全。</p>
<h2>六、联系我们</h2>
<p>如需删除评论，请在 GitHub Discussions 中处理，或通过网站公开联系方式联系站点维护者。</p>`, cfg, loggedInUsername)
}

function legalPage(title: string, content: string, cfg: SiteConfig, loggedInUsername?: string | null): string {
  return layout(title, `<div class="wrap"><div class="article"><h1>${esc(title)}</h1><div class="article-body">${content}</div></div></div>`, false, loggedInUsername, cfg)
}

export function postForm(post?: Post): string {
  const action = post ? `/admin/post/${post.id}` : '/admin/post'
  return layout(post ? '编辑文章' : '新建文章', `<div class="admin-wrap"><h1>${post ? '编辑文章' : '新建文章'}</h1>
<form method="post" action="${action}" id="pf">
  ${editorWidget(post?.title ?? '', post?.body ?? '', false)}
  <div style="margin-top:.75rem"><button class="btn" type="submit">保存</button></div>
</form></div>`, true)
}

export function settingsPage(cfg: SiteConfig, saved = false): string {
  const navLinksVal = cfg.navLinks.map(l => `${l.label}|${l.url}`).join('\n')
  return layout('站点设置', `<div class="admin-wrap"><h1>站点设置</h1>
${saved ? '<p style="color:green;margin-bottom:1rem">已保存</p>' : ''}
<form method="post" action="/admin/settings" style="display:flex;flex-direction:column;gap:.75rem;max-width:500px">
  <label style="font-size:.85rem;color:#555">站点名称</label>
  <input class="pf-input" name="title" value="${esc(cfg.title)}" required>
  <label style="font-size:.85rem;color:#555">首页描述</label>
  <textarea class="pf-input" name="desc" rows="3">${esc(cfg.desc)}</textarea>
  <label style="font-size:.85rem;color:#555">导航链接（每行一条，格式: 名称|URL）</label>
  <textarea class="pf-input" name="navLinks" rows="4" placeholder="归档|/archive&#10;关于|/about">${esc(navLinksVal)}</textarea>
  <div><button class="btn" type="submit">保存</button></div>
</form></div>
<style>.pf-input{padding:.65rem 1rem;border:1px solid var(--input-border);border-radius:6px;font-size:.95rem;outline:none;font-family:inherit;width:100%;background:var(--surface);color:var(--text)}.pf-input:focus{border-color:var(--text)}</style>`, true)
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
