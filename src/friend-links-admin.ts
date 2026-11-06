import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { layout } from './html'
import { listPages, savePageBody } from './pages'
import { friendDocument, friendFields } from './friend-links'
import type { FriendEntry } from './friend-links'
import type { Env } from './index'
import type { Context } from 'hono'
import { validateSession } from './auth'

type C=Context<{Bindings:Env}>
const base='/admin/friend-links'
const e=(text: string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]!)
async function revision(body: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))),b=>b.toString(16).padStart(2,'0')).join('')
}
function view(title: string,body: string) {
  return layout(title,`<style>.friend-admin-form{margin-top:1rem}.friend-admin-form label{display:grid;gap:.4rem;font-size:.9rem}.friend-admin-form input,.friend-admin-form textarea{width:100%;min-width:0}.friend-admin-form textarea{font:inherit;padding:.65rem 1rem;border:1px solid var(--input-border);border-radius:6px;background:var(--surface);color:var(--text);resize:vertical}</style><main class="admin-wrap"><p style="margin-bottom:1rem"><a href="${base}">友链管理</a> · <a href="/p/friend-link">查看前台</a></p>${body}</main>`,true)
}
function form(row: FriendEntry | undefined, stamp: string, order: number) {
  return view(row?'编辑友链':'新增友链',`<h1>${row?'编辑友链':'新增友链'}</h1><form class="form-group friend-admin-form" method="post" action="${base}${row?'/'+e(row.id):''}"><input type="hidden" name="revision" value="${stamp}"><label>站点名称<input name="name" maxlength="160" required value="${e(row?.name||'')}"></label><label>网站地址<input type="url" name="url" maxlength="2048" required placeholder="https://example.com/" value="${e(row?.url||'')}"></label><label>简介<textarea name="description" maxlength="1000" rows="3">${e(row?.description||'')}</textarea></label><label>头像地址（可选）<input name="avatar" maxlength="2048" placeholder="留空使用网站 icon" value="${e(row?.avatar||'')}"></label><p class="auth-prompt">不填写头像时使用对方网站的 /favicon.ico；头像加载失败也会尝试该 icon。</p><label>排序（数字小的在前）<input type="number" name="order" required min="0" max="999999" value="${row?.order??order}"></label><button class="btn">保存友链</button></form>`)
}
export function friendAdminRoutes() {
  const app=new Hono<{Bindings:Env}>()
  app.use(base+'/*',async(c,next)=>{
    c.header('Cache-Control','no-store')
    if (!await validateSession(c)) return c.redirect('/admin/login')
    await next()
  })
  const limit=bodyLimit({maxSize:16*1024,onError:c=>c.text('请求内容过长',413)})
  app.use(base+'/*',async(c,next)=>{
    const headers=new Headers(c.req.raw.headers); headers.delete('Content-Length')
    c.req.raw=new Request(c.req.raw,{headers})
    return limit(c,next)
  })
  async function page(c: C) {
    // Management also supports an unpublished friend page without publishing it.
    return (await listPages(c)).find(row=>row.slug==='friend-link') || null
  }
  app.get(base,async c=>{
    const current=await page(c)
    if (!current) return c.html(view('友链管理','<h1>友链管理</h1><p>请先在页面管理中新建路径为 friend-link 的页面。</p><a href="/admin/page/new">新建友链页面</a>'))
    const data=friendDocument(current.body),stamp=await revision(current.body)
    return c.html(view('友链管理',`<h1>友链管理</h1><p style="margin:1rem 0"><a class="btn btn-sm" href="${base}/new">新增友链</a></p><div style="overflow-x:auto"><table><thead><tr><th>站点</th><th>简介</th><th>排序</th><th>操作</th></tr></thead><tbody>${[...data.entries].sort((a,b)=>a.order-b.order).map(row=>`<tr><td><a href="${e(row.url)}" target="_blank" rel="noopener noreferrer">${e(row.name)}</a></td><td>${e(row.description)}</td><td>${row.order}</td><td class="actions"><a href="${base}/${e(row.id)}/edit">编辑</a><form method="post" action="${base}/${e(row.id)}/delete" onsubmit="return confirm('确认删除这条友链？')"><input type="hidden" name="revision" value="${stamp}"><button class="btn btn-sm btn-danger">删除</button></form></td></tr>`).join('') || '<tr><td colspan="4">暂无友链</td></tr>'}</tbody></table></div>`))
  })
  app.get(base+'/new',async c=>{
    const current=await page(c);if(!current)return c.notFound()
    const entries=friendDocument(current.body).entries
    return c.html(form(undefined,await revision(current.body),Math.min(999999,Math.max(-1,...entries.map(row=>row.order))+1)))
  })
  app.get(base+'/:id/edit',async c=>{
    const current=await page(c);if(!current)return c.notFound()
    const row=friendDocument(current.body).entries.find(row=>row.id===c.req.param('id'));if(!row)return c.notFound()
    return c.html(form(row,await revision(current.body),0))
  })
  async function save(c: C, action:'create'|'edit'|'delete') {
    const current=await page(c);if(!current)return c.notFound()
    if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(c.req.header('Content-Type')||''))return c.text('表单格式无效',400)
    const f=new URLSearchParams(await c.req.text())
    if (f.get('revision')!==await revision(current.body)) return c.text('友链已更新，请刷新管理页面后重试',409)
    const data=friendDocument(current.body), index=data.entries.findIndex(row=>row.id===c.req.param('id'))
    if (action!=='create' && index<0) return c.notFound()
    if (action==='delete') data.entries.splice(index,1)
    else {
      const values=friendFields({name:f.get('name')||'',url:f.get('url')||'',avatar:f.get('avatar')||'',description:f.get('description')||'',order:f.get('order')||''})
      if (!values) return c.text('请检查名称、网址、头像地址、简介及排序。网址只支持 HTTP/HTTPS。',400)
      if (action==='create') {
        if (data.entries.length>=200)return c.text('最多可添加 200 条友链',400)
        data.entries.push({id:crypto.randomUUID(),...values})
      } else data.entries[index]={id:data.entries[index].id,...values}
    }
    const body=JSON.stringify(data)
    if (body.length>200000)return c.text('友链内容过长',413)
    if (!await savePageBody(c,current,body))return c.text('友链已更新，请刷新管理页面后重试',409)
    return c.redirect(base,303)
  }
  app.post(base,c=>save(c,'create'))
  app.post(base+'/:id',c=>save(c,'edit'))
  app.post(base+'/:id/delete',c=>save(c,'delete'))
  return app
}
