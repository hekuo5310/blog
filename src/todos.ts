import { giscusReady } from './todo-giscus'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { Context } from 'hono'
import type { Env } from './index'
import type { SiteConfig } from './html'
import { validateSession } from './auth'
import { todoTasks } from './todo-tasks'
import taskClient from './todo-tasks-client.js.txt'
import { todoList, todoDetail, todoForm, templatesPage, todoLayout, states } from './todos-view'

export type Todo = { id: number; title: string; body: string; labels: string; status: string; locked: number; created_at: string; updated_at: string; reply_count?: number }
export type TodoReply = { id: number; todo_id: number; parent_id: number | null; author: string; body: string; is_admin: number; created_at: string; parent_author?: string | null }
export type TodoTemplate = { id: number; name: string; title: string; body: string; labels: string }
type C = Context<{ Bindings: Env }>
const pageSize = 30
export function parseTodoLabels(text: string): string[] | null {
  const values = [...new Set(text.split(/[,，]/).map(x => x.trim()).filter(Boolean))]
  return values.length <= 10 && values.every(x => x.length <= 30 && !/[\x00-\x1f\x7f]/.test(x)) ? values : null
}
function id(raw: string | undefined): number | null {
  return raw && /^[1-9]\d{0,14}$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null
}
function page(raw: string | undefined) { return Math.min(10000, Math.max(1, Number(raw) || 1) | 0) }
function sameOrigin(c: C) {
  if (c.req.header('Sec-Fetch-Site') === 'cross-site') return false
  const source = c.req.header('Origin') || c.req.header('Referer')
  try { return !!source && new URL(source).origin === new URL(c.req.url).origin } catch { return false }
}
async function form(c: C) {
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(c.req.header('Content-Type') || '')) return null
  return new URLSearchParams(await c.req.text())
}
function itemValues(f: URLSearchParams) {
  const title = (f.get('title') || '').trim(), body = (f.get('body') || '').trim()
  const labels = parseTodoLabels(f.get('labels') || ''), status = f.get('status') || 'open'
  if (!title || title.length > 160 || !body || body.length > 16000 || !labels || !Object.hasOwn(states, status)) return null
  return {title, body, labels: JSON.stringify(labels), status, locked: f.get('locked') === '1' ? 1 : 0}
}
export function todoRoutes(config: (env: Env) => Promise<SiteConfig>) {
  const app = new Hono<{ Bindings: Env }>()
  app.get('/assets/todo-tasks.js', c => c.body(taskClient,200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=300'}))
  const limit = bodyLimit({ maxSize: 96 * 1024, onError: c => c.text('请求内容过长', 413) })
  const limited = async (c: C, next: () => Promise<void>) => {
    // Always count the stream, including a forged or missing Content-Length.
    const headers = new Headers(c.req.raw.headers); headers.delete('Content-Length')
    c.req.raw = new Request(c.req.raw, { headers })
    return limit(c, next)
  }
  app.use('/todos/*', limited)
  app.use('/admin/todos/*', limited)
  app.use('/todos/*', async (c, next) => {
    if (c.req.method === 'POST' && !sameOrigin(c)) return c.text('请从本站提交回复', 403)
    await next()
  })
  async function protectedAdmin(c: C, next: () => Promise<void>) {
    c.header('Cache-Control', 'no-store')
    if (!await validateSession(c)) return c.redirect('/admin/login')
    await next()
  }
  app.use('/admin/todos/*', protectedAdmin)
  const get = (c: C, key = 'id') => {
    const value = id(c.req.param(key))
    return value ? c.env.DB.prepare('SELECT * FROM todo_items WHERE id=?').bind(value).first<Todo>() : Promise.resolve(null)
  }
  async function invalid(c: C, message = '输入无效，请检查标题、正文、标签及状态。') {
    return c.html(todoLayout('无法提交', `<h1>无法提交</h1><p role="alert">${message}</p><p>请返回上一页修改后重试。</p><a href="/todos">返回待办列表</a>`, await config(c.env)), 400)
  }
  async function list(c: C, admin: boolean) {
    const status = c.req.query('status') || 'open', label = (c.req.query('label') || '').trim(), q = (c.req.query('q') || '').trim(), p = page(c.req.query('page'))
    if (!(status === 'all' || Object.hasOwn(states, status)) || label.length > 30 || q.length > 100) return invalid(c)
    const where: string[] = [], args: (string | number)[] = []
    if (status !== 'all') { where.push('t.status=?'); args.push(status) }
    if (label) { where.push('EXISTS (SELECT 1 FROM json_each(t.labels) WHERE value=?)'); args.push(label) }
    if (q) { where.push('(instr(lower(t.title),lower(?))>0 OR instr(lower(t.body),lower(?))>0)'); args.push(q,q) }
    const [{results: items}, {results: counts}, cfg] = await Promise.all([
      c.env.DB.prepare(`SELECT t.*, (SELECT COUNT(*) FROM todo_replies r WHERE r.todo_id=t.id) AS reply_count FROM todo_items t ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.updated_at DESC,t.id DESC LIMIT ? OFFSET ?`).bind(...args, pageSize + 1, (p-1)*pageSize).all<Todo>(),
      c.env.DB.prepare('SELECT status,COUNT(*) AS count FROM todo_items GROUP BY status').all<{status: string; count: number}>(), config(c.env)
    ])
    return c.html(todoList(items.slice(0,pageSize), Object.fromEntries(counts.map(x => [x.status,x.count])), {status,label,q,page:p}, items.length > pageSize, cfg, admin, c.req.path === '/todos', giscusReady(c.env)))
  }
  app.get('/todos', async c => {
    c.header('Cache-Control', 'no-store')
    return list(c, await validateSession(c))
  })
  app.get('/admin/todos', c => c.redirect('/todos',302))
  app.get('/todos/new', async c => {
    c.header('Cache-Control','no-store')
    if (!await validateSession(c)) return c.redirect('/admin/login')
    const {results} = await c.env.DB.prepare('SELECT * FROM todo_templates ORDER BY id').all<TodoTemplate>()
    const selected = results.find(t => t.id === id(c.req.query('template')))
    return c.html(todoForm(selected ? {...selected,status:'open',locked:0} : null,results,await config(c.env),true,true))
  })
  app.get('/todos/templates', async c => {
    c.header('Cache-Control','no-store')
    if (!await validateSession(c)) return c.redirect('/admin/login')
    const {results} = await c.env.DB.prepare('SELECT * FROM todo_templates ORDER BY id').all<TodoTemplate>()
    return c.html(templatesPage(results,await config(c.env),true))
  })
  app.get('/todos/:id/edit', async c => {
    c.header('Cache-Control','no-store')
    if (!await validateSession(c)) return c.redirect('/admin/login')
    const todo = await get(c); if (!todo) return c.notFound()
    return c.html(todoForm(todo,[],await config(c.env),false,true))
  })
  app.get('/todos/:id', async c => {
    const todo = await get(c); if (!todo) return c.notFound()
    c.header('Cache-Control', 'no-store')
    const p = page(c.req.query('page'))
    const [{results: replies}, admin, cfg] = await Promise.all([
      c.env.DB.prepare('SELECT r.*,p.author AS parent_author FROM todo_replies r LEFT JOIN todo_replies p ON p.id=r.parent_id AND p.todo_id=r.todo_id WHERE r.todo_id=? ORDER BY r.id LIMIT 51 OFFSET ?').bind(todo.id,(p-1)*50).all<TodoReply>(), validateSession(c), config(c.env)
    ])
    const parentId = id(c.req.query('reply'))
    const parent = parentId ? await c.env.DB.prepare('SELECT * FROM todo_replies WHERE id=? AND todo_id=?').bind(parentId,todo.id).first<TodoReply>() : null
    return c.html(todoDetail(todo,replies.slice(0,50),p,replies.length>50,cfg,admin,c.req.query('sent') === '1' ? '回复已发表。' : '',parent,giscusReady(c.env)))
  })
  app.get('/admin/todos/new', async c => {
    const {results} = await c.env.DB.prepare('SELECT * FROM todo_templates ORDER BY id').all<TodoTemplate>()
    const selected = results.find(t => t.id === id(c.req.query('template')))
    return c.html(todoForm(selected ? {...selected,status:'open',locked:0} : null,results,await config(c.env),true))
  })
  app.post('/admin/todos', async c => {
    const f = await form(c), values = f && itemValues(f)
    if (!values) return invalid(c)
    const result = await c.env.DB.prepare('INSERT INTO todo_items(title,body,labels,status,locked) VALUES (?,?,?,?,?)').bind(values.title,values.body,values.labels,values.status,values.locked).run()
    return c.redirect(`/todos/${result.meta.last_row_id}`,303)
  })
  app.get('/admin/todos/templates', async c => {
    const {results} = await c.env.DB.prepare('SELECT * FROM todo_templates ORDER BY id').all<TodoTemplate>()
    return c.html(templatesPage(results,await config(c.env)))
  })
  async function saveTemplate(c: C, update: boolean) {
    const f = await form(c)
    const name = f?.get('name')?.trim() || '', title = f?.get('title')?.trim() || '', body = f?.get('body')?.trim() || '', labels = parseTodoLabels(f?.get('labels') || '')
    if (!name || name.length>80 || title.length>160 || !body || body.length>16000 || !labels) return invalid(c)
    if (update) {
      const key = id(c.req.param('id')); if (!key) return c.notFound()
      const r = await c.env.DB.prepare('UPDATE todo_templates SET name=?,title=?,body=?,labels=? WHERE id=?').bind(name,title,body,JSON.stringify(labels),key).run()
      if (!r.meta.changes) return c.notFound()
    } else await c.env.DB.prepare('INSERT INTO todo_templates(name,title,body,labels) VALUES (?,?,?,?)').bind(name,title,body,JSON.stringify(labels)).run()
    return c.redirect(f?.get('frontend') === '1' ? '/todos/templates' : '/admin/todos/templates',303)
  }
  app.post('/admin/todos/templates', c => saveTemplate(c,false))
  app.post('/admin/todos/templates/:id', c => saveTemplate(c,true))
  app.post('/admin/todos/templates/:id/delete', async c => {
    const key = id(c.req.param('id')); if (!key) return c.notFound()
    const f = await form(c)
    await c.env.DB.prepare('DELETE FROM todo_templates WHERE id=?').bind(key).run()
    return c.redirect(f?.get('frontend') === '1' ? '/todos/templates' : '/admin/todos/templates',303)
  })
  app.get('/admin/todos/:id/edit', async c => {
    const todo = await get(c); if (!todo) return c.notFound()
    return c.html(todoForm(todo,[],await config(c.env),false))
  })
  app.post('/admin/todos/:id', async c => {
    const todo = await get(c); if (!todo) return c.notFound()
    const f = await form(c), values = f && itemValues(f)
    if (!values) return invalid(c)
    await c.env.DB.prepare("UPDATE todo_items SET title=?,body=?,labels=?,status=?,locked=?,updated_at=datetime('now') WHERE id=?").bind(values.title,values.body,values.labels,values.status,values.locked,todo.id).run()
    return c.redirect(`/todos/${todo.id}`,303)
  })
  app.post('/admin/todos/:id/state', async c => {
    const todo = await get(c); if (!todo) return c.notFound()
    const f = await form(c); if (!f) return invalid(c)
    const status = f.get('status'), locked = f.get('locked')
    if (status !== null && Object.hasOwn(states,status) && locked === null) {
      await c.env.DB.prepare("UPDATE todo_items SET status=?,updated_at=datetime('now') WHERE id=?").bind(status,todo.id).run()
    } else if (status === null && (locked === '0' || locked === '1')) {
      await c.env.DB.prepare("UPDATE todo_items SET locked=?,updated_at=datetime('now') WHERE id=?").bind(Number(locked),todo.id).run()
    } else return invalid(c)
    return c.redirect(`/todos/${todo.id}`,303)
  })
  app.post('/admin/todos/:id/tasks', async c => {
    c.header('Cache-Control','no-store')
    const todo = await get(c); if (!todo) return c.notFound()
    const f = await form(c)
    const original = f?.get('body'), rawOffset = f?.get('offset') || '', checked = f?.get('checked')
    if (typeof original !== 'string' || original.length > 16000 || !/^\d{1,5}$/.test(rawOffset) || (checked !== '0' && checked !== '1')) return c.text('任务参数无效',400)
    if (original !== todo.body) return c.text('正文已更新，请刷新后重试',409)
    const offset = Number(rawOffset)
    if (!todoTasks(original).includes(offset)) return c.text('不是有效的任务复选框',400)
    const body = original.slice(0,offset) + (checked === '1' ? 'x' : ' ') + original.slice(offset+1)
    const result = await c.env.DB.prepare("UPDATE todo_items SET body=?,updated_at=datetime('now') WHERE id=? AND body=?").bind(body,todo.id,original).run()
    if (!result.meta.changes) return c.text('正文已更新，请刷新后重试',409)
    return c.json({ok:true})
  })
  app.post('/admin/todos/:id/delete', async c => {
    const todo = await get(c); if (!todo) return c.notFound()
    const f = await form(c)
    await c.env.DB.batch([c.env.DB.prepare('DELETE FROM todo_replies WHERE todo_id=?').bind(todo.id),c.env.DB.prepare('DELETE FROM todo_items WHERE id=?').bind(todo.id)])
    return c.redirect(f?.get('frontend') === '1' ? '/todos' : '/admin/todos',303)
  })
  app.post('/admin/todos/:id/replies/:replyId/delete', async c => {
    const todo = await get(c), key = id(c.req.param('replyId')); if (!todo || !key) return c.notFound()
    await c.env.DB.prepare('DELETE FROM todo_replies WHERE id=? AND todo_id=?').bind(key,todo.id).run()
    return c.redirect(`/todos/${todo.id}`,303)
  })
  app.post('/todos/:id/replies', async c => {
    if (giscusReady(c.env)) return c.text('新回复已迁移到 GitHub 讨论，请返回待办页面使用 GitHub 登录。',409)
    c.header('Cache-Control', 'no-store')
    const todo = await get(c); if (!todo) return c.notFound()
    const admin = await validateSession(c)
    if (todo.locked && !admin) return c.text('讨论已锁定',403)
    const f = await form(c); if (!f) return invalid(c)
    const author = admin ? '管理员' : (f.get('author') || '').trim(), body = (f.get('body') || '').trim()
    if (!author || author.length>40 || !body || body.length>4000 || f.get('website')) return invalid(c)
    const parentId = f.get('parent_id') ? id(f.get('parent_id')!) : null
    if (f.get('parent_id') && (!parentId || !await c.env.DB.prepare('SELECT id FROM todo_replies WHERE id=? AND todo_id=?').bind(parentId,todo.id).first())) return invalid(c)
    if (!admin) {
      // Only a salted, short-lived digest is stored; never persist the raw IP.
      if (!c.env.ADMIN_PASS) return c.text('回复暂不可用',503)
      const now = Math.floor(Date.now()/1000), day = new Date().toISOString().slice(0,10)
      const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.env.ADMIN_PASS + '\0todo\0' + (c.req.header('CF-Connecting-IP') || 'unknown')))
      const key = Array.from(new Uint8Array(digest),b => b.toString(16).padStart(2,'0')).join('')
      // Conditional UPSERT is atomic, including concurrent requests across isolates.
      const permit = await c.env.DB.prepare(`INSERT INTO todo_reply_limits(key,last_at,day,count,expires_at) VALUES (?,?,?,1,?) ON CONFLICT(key) DO UPDATE SET last_at=excluded.last_at,day=excluded.day,count=CASE WHEN todo_reply_limits.day=excluded.day THEN todo_reply_limits.count+1 ELSE 1 END,expires_at=excluded.expires_at WHERE todo_reply_limits.last_at<=excluded.last_at-60 AND (todo_reply_limits.day<>excluded.day OR todo_reply_limits.count<10) RETURNING key`).bind(key,now,day,now+86400).first()
      if (!permit) { c.header('Retry-After','60'); return c.text('回复过于频繁，请稍后重试（每分钟 1 条，每天 10 条）。',429) }
      await c.env.DB.prepare('DELETE FROM todo_reply_limits WHERE expires_at<?').bind(now).run()
    }
    const result = await c.env.DB.prepare(`INSERT INTO todo_replies(todo_id,parent_id,author,body,is_admin) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM todo_items WHERE id=? AND (locked=0 OR ?=1)) AND (? IS NULL OR EXISTS (SELECT 1 FROM todo_replies WHERE id=? AND todo_id=?))`).bind(todo.id,parentId,author,body,admin?1:0,todo.id,admin?1:0,parentId,parentId,todo.id).run()
    if (!result.meta.changes) return c.text('讨论状态已变化，请刷新后重试',409)
    await c.env.DB.prepare("UPDATE todo_items SET updated_at=datetime('now') WHERE id=?").bind(todo.id).run()
    const row = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM todo_replies WHERE todo_id=? AND id<=?').bind(todo.id,result.meta.last_row_id).first<{count:number}>()
    return c.redirect(`/todos/${todo.id}?sent=1&page=${Math.max(1,Math.ceil((row?.count || 1)/50))}#reply-${result.meta.last_row_id}`,303)
  })
  return app
}
