export type Post = { id: number; title: string; slug: string; body: string; published: number; created_at: string; ai_summary?: string | null }
export type Comment = { id: number; post_id: number; author: string; body: string; created_at: string; user_id: number | null }
export type SiteConfig = { title: string; desc: string; navLinks: { label: string; url: string }[] }
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
.hm-months{display:flex;font-size:.7rem;color:var(--faint);gap:0;margin-bottom:3px}
.hm-month{flex:1;min-width:0}
.hm-cells{display:grid;grid-template-rows:repeat(7,10px);grid-auto-flow:column;grid-auto-columns:10px;gap:2px}
.hm-cell{width:10px;height:10px;border-radius:2px;background:var(--hm-empty)}
.hm-cell[data-l="1"]{background:var(--hm-1)}
.hm-cell[data-l="2"]{background:var(--hm-2)}
.hm-cell[data-l="3"]{background:var(--hm-3)}
.hm-cell[data-l="4"]{background:var(--hm-4)}
.hm-legend{display:flex;align-items:center;gap:4px;font-size:.75rem;color:var(--faint);justify-content:flex-end;margin-top:.5rem}
.hm-legend .hm-cell{display:inline-block}
.hm-year-button{background:none;border:none;cursor:pointer;font-size:.8rem;color:var(--faint);font-family:inherit}
.hm-year-button.active{color:var(--text);font-weight:700}

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
.ai-summary-block{margin:1rem 0}
.ai-summary-box{margin-top:1rem;padding:.9rem 1.1rem;border:1px solid var(--input-border);border-left:3px solid var(--accent);border-radius:6px;background:var(--bg-soft)}
.ai-summary-label{display:inline-block;font-size:.78rem;font-weight:600;color:var(--accent);margin-bottom:.4rem;letter-spacing:.03em}
.ai-summary-text{font-size:.92rem;line-height:1.7;color:var(--text-soft)}

/* comments */
.comments{margin-top:3rem;border-top:1px solid var(--border);padding-top:2rem}
.comments h2{font-size:1.1rem;font-weight:600;margin-bottom:1.5rem}
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
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — ${esc(cfg.title)}</title><script>
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
  var updatesEl=document.getElementById('update-data');
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
    var normalized=value.indexOf(' ')>=0?value.replace(' ','T')+'Z':value;
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
    var items=[];
    if(updatesEl){
      try{items=JSON.parse(updatesEl.textContent||'[]')}catch(e){items=[]}
    }
    if(items.length)return Promise.resolve(items);
    return fetch('/updates.json',{headers:{Accept:'application/json'}})
      .then(function(res){return res.ok?res.json():[]})
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
  return md.replace(/[#*`_\[\]]/g, '').slice(0, len).trim() + (md.length > len ? '…' : '')
}

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
<script>
(function(){
const src=document.getElementById('md-src'),prev=document.getElementById('md-prev'),status=document.getElementById('image-upload-status');
function render(){prev.innerHTML=marked.parse(src.value||'',{breaks:true});}
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

function heatmap(posts: Post[]): string {
  const dates = posts.map(p => p.created_at.slice(0, 10))
  const years = [...new Set(dates.map(d => d.slice(0, 4)))].sort()
  const datesJson = JSON.stringify(dates)
  const yearsJson = JSON.stringify(years)

  return `<div class="heatmap-wrap">
<div class="heatmap-title">
  <span>文章发布热力图</span>
  <span id="hm-year-nav" style="display:flex;gap:.4rem;align-items:center"></span>
</div>
<div class="heatmap">
  <div class="hm-ylabels"><span></span><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span></div>
  <div class="hm-grid">
    <div class="hm-months" id="hm-months"></div>
    <div class="hm-cells" id="hm-cells"></div>
  </div>
</div>
<div class="hm-legend">少 <div class="hm-cell" data-l="0"></div><div class="hm-cell" data-l="1"></div><div class="hm-cell" data-l="2"></div><div class="hm-cell" data-l="3"></div><div class="hm-cell" data-l="4"></div> 多</div>
</div>
<script>
(function(){
const dates=${datesJson}, allYears=${yearsJson};
const counts={};
dates.forEach(d=>{counts[d]=(counts[d]||0)+1});
const MONTHS=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
let curYear=new Date().getFullYear();
if(!allYears.includes(String(curYear))&&allYears.length) curYear=Number(allYears[allYears.length-1]);

function render(year){
  const start=new Date(year,0,1), startDay=start.getDay(), totalWeeks=53;
  const cells=[], months=new Array(12).fill(-1);
  for(let w=0;w<totalWeeks;w++){
    for(let d=0;d<7;d++){
      const date=new Date(year,0,1+w*7+d-startDay);
      if(date.getFullYear()!==year){cells.push('<div class="hm-cell"></div>');continue;}
      const key=date.toISOString().slice(0,10);
      const c=counts[key]||0, l=c===0?0:c===1?1:c<=3?2:c<=5?3:4;
      if(d===0&&months[date.getMonth()]===-1)months[date.getMonth()]=w;
      cells.push('<div class="hm-cell" data-l="'+l+'" title="'+key+': '+c+'"></div>');
    }
  }
  document.getElementById('hm-cells').innerHTML=cells.join('');
  document.getElementById('hm-months').innerHTML=MONTHS.map((m,i)=>{
    const w=months[i];return w<0?'<span class="hm-month"></span>':'<span class="hm-month">'+m+'</span>';
  }).join('');

  // year nav
  const allY=[...new Set([...allYears,String(new Date().getFullYear())])].sort();
  document.getElementById('hm-year-nav').innerHTML=allY.map(y=>
    '<button class="hm-year-button '+(Number(y)===year?'active':'')+'" onclick="hmYear('+y+')">'+y+'</button>'
  ).join('');
}
window.hmYear=function(y){curYear=y;render(y)};
render(curYear);
})();
</script>`
}

export function postList(posts: Post[], loggedInUsername?: string | null, cfg: SiteConfig = DEFAULT_CONFIG): string {
  const items = posts.length
    ? posts.map(p => `<div class="post-item">
  <div class="post-date">${p.created_at.slice(0, 10)}</div>
  <div><a href="/post/${p.slug}" class="post-title">${esc(p.title)}</a><div class="post-excerpt">${excerpt(p.body)}</div></div>
</div>`).join('')
    : '<p style="color:#aaa;padding:2rem 0">暂无文章</p>'

  const body = `<div class="wrap">
<div class="hero"><h1>${esc(cfg.title)}<span class="cursor"></span></h1><p class="hero-desc">${esc(cfg.desc)}</p></div>
${heatmap(posts)}
<div class="post-list">${items}</div>
</div>` 
  return layout(cfg.title, body, false, loggedInUsername, cfg, updateItems(posts))
}

export function postDetail(post: Post, comments: Comment[], loggedInUsername: string | null, cfg: SiteConfig = DEFAULT_CONFIG): string {
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

  const body = `<div class="wrap"><div class="article">
<h1>${esc(post.title)}</h1>
<div class="article-meta">${post.created_at.slice(0, 10)}</div>
<div class="article-body" id="post-body"></div>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script>
(function(){
var raw=${JSON.stringify(post.body)};
var summaries=${JSON.stringify(summaries)};
var re=/\\[ai-summary\\]([\\s\\S]*?)\\[\\/ai-summary\\]/g;
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
var out='',last=0,m,i=0;
while((m=re.exec(raw))!==null){
  out+=marked.parse(raw.slice(last,m.index),{breaks:true});
  var summary=summaries[i++];
  out+='<div class="ai-summary-block">'+marked.parse(m[1],{breaks:true});
  if(summary){out+='<div class="ai-summary-box"><span class="ai-summary-label">AI 总结</span><div class="ai-summary-text">'+esc(summary)+'</div></div>';}
  out+='</div>';
  last=m.index+m[0].length;
}
out+=marked.parse(raw.slice(last),{breaks:true});
document.getElementById('post-body').innerHTML=out;
})();
</script>
<div class="comments">
  <h2>评论 (${comments.length})</h2>
  ${commentList}
  ${commentForm}
</div>
</div></div>`
  return layout(post.title, body, false, loggedInUsername, cfg)
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
<script>document.getElementById('post-body').innerHTML=marked.parse(${JSON.stringify(page.body)},{breaks:true});</script>
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
