import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from './index'
import { sameOrigin } from './auth'
import { isConfigured } from './config'
import api from '../third_party/giscus/api.js.txt'
import license from '../third_party/giscus/LICENSE.txt'
import client from './todo-giscus-client.js.txt'

type C = Context<{Bindings: Env}>
export function giscusReady(env: Env) {
  return [env.GISCUS_REPO_ID,env.GISCUS_CATEGORY_ID,env.GISCUS_CATEGORY].every(isConfigured)
}
async function bounded(body: ReadableStream<Uint8Array> | null, max: number) {
  if (!body) return ''
  const reader = body.getReader(), chunks: Uint8Array[] = []; let size=0
  try { while (true) {const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>max){await reader.cancel();throw Error('size')}chunks.push(part.value)} }
  finally {reader.releaseLock()}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}return new TextDecoder().decode(bytes)
}
async function upstream(path: string, token: string, body?: unknown) {
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000)
  try {
    const response=await fetch('https://giscus.app'+path,{method:body===undefined?'GET':'POST',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal,redirect:'error'})
    return {status:response.status,data:JSON.parse(await bounded(response.body,2*1024*1024)) as Record<string,unknown>}
  } finally {clearTimeout(timer)}
}
function bearer(c: C) { const h=c.req.header('Authorization')||'';return /^Bearer [\x21-\x7e]{1,2048}$/.test(h)?h.slice(7):'' }
const callback = `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>完成 GitHub 登录</title><p id="status">正在完成 GitHub 登录…</p><script>
(function(){var q=new URLSearchParams(location.search);history.replaceState(null,'','/api/todo-giscus/callback');try{var state=q.get('state'),pending=JSON.parse(sessionStorage.getItem('todo-giscus-pending')||'null');sessionStorage.removeItem('todo-giscus-pending');if(!pending||state!==pending.state||Date.now()-pending.at>600000||!/^\\d+$/.test(pending.id))throw Error('授权状态失效，请返回待办重新登录。');var session=q.get('giscus');if(!session||session.length>16000)throw Error('授权未完成，请返回待办重试。');sessionStorage.setItem('todo-giscus-session',session);location.replace('/todos/'+pending.id+'#giscus-discussion');}catch(e){document.getElementById('status').textContent=e.message;}})();</script></html>`
export function todoGiscusRoutes() {
  const app=new Hono<{Bindings:Env}>()
  app.onError((_error,c)=>c.json({error:'讨论服务暂不可用，请稍后重试'},503))
  app.get('/assets/todo-giscus-api.js',c=>c.body(api,200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=300'}))
  app.get('/assets/todo-giscus-client.js',c=>c.body(client,200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'public, max-age=300'}))
  app.get('/assets/todo-giscus-LICENSE.txt',c=>c.text(license))
  app.use('/api/todo-giscus/*',async(c,next)=>{
    c.header('Cache-Control','no-store')
    if(c.req.method==='POST'&&!sameOrigin(c))return c.json({error:'请从本站提交请求'},403)
    try { await next() } catch {return c.json({error:'讨论服务暂不可用，请稍后重试'},503)}
  })
  app.get('/api/todo-giscus/callback',c=>c.html(callback))
  app.post('/api/todo-giscus/token',async c=>{
    if(!/^application\/json(?:;|$)/i.test(c.req.header('Content-Type')||''))return c.json({error:'需要 JSON'},400)
    let body: {session?:unknown}
    try { body=JSON.parse(await bounded(c.req.raw.body,20000)) }catch{return c.json({error:'授权数据无效或过长'},400)}
    if(!body||typeof body.session!=='string'||!body.session||body.session.length>16000)return c.json({error:'授权数据无效'},400)
    const r=await upstream('/api/oauth/token','',{session:body.session})
    if(r.status!==200||typeof r.data.token!=='string')return c.json({error:'GitHub 登录已失效，请重新登录'},401)
    return c.json({token:r.data.token})
  })
  async function item(c:C) {
    const value=c.req.param('id')||''
    return /^[1-9]\d{0,14}$/.test(value)?c.env.DB.prepare('SELECT id,title,locked FROM todo_items WHERE id=?').bind(Number(value)).first<{id:number;title:string;locked:number}>():null
  }
  app.get('/api/todo-giscus/:id',async c=>{
    const todo=await item(c);if(!todo)return c.json({error:'待办不存在'},404)
    if(!giscusReady(c.env))return c.json({error:'讨论尚未配置，请检查博客 GISCUS 设置'},503)
    const after=c.req.query('after')||'';if(after.length>512)return c.json({error:'分页参数无效'},400)
    const query=new URLSearchParams({repo:c.env.GISCUS_REPO||'hekuo5310/blog',category:c.env.GISCUS_CATEGORY!,term:'blog/todos/'+todo.id,strict:'true',first:'20',...(after?{after}:{})})
    const r=await upstream('/api/discussions?'+query,bearer(c))
    if(r.status===404)return c.json({discussion:null,viewer:null})
    if(r.status!==200)return c.json({error:r.status===403?'GitHub 登录已失效，请重新登录':'讨论加载失败，请稍后重试'},r.status===403?401:r.status===429?429:503)
    return c.json(r.data)
  })
  app.post('/api/todo-giscus/:id',async c=>{
    const todo=await item(c);if(!todo)return c.json({error:'待办不存在'},404)
    if(todo.locked)return c.json({error:'讨论已锁定'},403)
    if(!giscusReady(c.env))return c.json({error:'讨论尚未配置'},503)
    const token=bearer(c);if(!token)return c.json({error:'请先使用 GitHub 登录'},401)
    const query=new URLSearchParams({repo:c.env.GISCUS_REPO||'hekuo5310/blog',category:c.env.GISCUS_CATEGORY!,term:'blog/todos/'+todo.id,strict:'true',first:'1'})
    const existing=await upstream('/api/discussions?'+query,token)
    const discussion=existing.data.discussion as {id?:unknown}|undefined
    if(existing.status===200&&typeof discussion?.id==='string')return c.json({id:discussion.id})
    if(existing.status!==404&&existing.status!==200)return c.json({error:'讨论加载失败，未重复创建，请稍后重试'},503)
    // No client-controlled repository, title, body, upstream URL or category.
    const r=await upstream('/api/discussions',token,{repo:c.env.GISCUS_REPO||'hekuo5310/blog',input:{repositoryId:c.env.GISCUS_REPO_ID,categoryId:c.env.GISCUS_CATEGORY_ID,title:'blog/todos/'+todo.id,body:'# '+todo.title+'\n\n'+new URL('/todos/'+todo.id,c.req.url).href}})
    if(r.status!==200||typeof r.data.id!=='string')return c.json({error:'无法创建讨论，请检查 GitHub 授权与 Giscus 配置'},r.status===403?401:503)
    return c.json({id:r.data.id})
  })
  return app
}
