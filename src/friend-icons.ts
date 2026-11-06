import { Hono } from 'hono'
import type { Env } from './index'
import { getPageBySlug } from './pages'
import { friendDocument } from './friend-links'
import { SITE_ICON } from './site-icon'

// Only configured public websites are fetched; never forward visitor credentials.
export function publicIconUrl(raw: string, base?: string): URL | null {
  try {
    const url=new URL(raw,base), host=url.hostname.toLowerCase().replace(/\.$/,'')
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port || raw.length>4096 || !host.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':') || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)) return null
    return url
  } catch { return null }
}
async function headText(response: Response) {
  const reader=response.body?.getReader();if(!reader)return ''
  const decoder=new TextDecoder();let text='',bytes=0
  try {
    while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>128*1024)break;text+=decoder.decode(part.value,{stream:true});if(/<\/head\s*>/i.test(text))break}
  } finally {await reader.cancel();reader.releaseLock()}
  return text
}
export async function readHeadIcon(html: string, pageUrl: string) {
  // HTMLRewriter preserves character references in attribute values.
  const attribute=(value:string)=>value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(_match,key:string)=>{
    if(key[0]!=='#')return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'})[key.toLowerCase()]||''
    const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10)
    return n>0 && n<=0x10ffff && !(n>=0xd800 && n<=0xdfff)?String.fromCodePoint(n):'\ufffd'
  })
  let base=pageUrl, hasBase=false
  const icons:{href:string;priority:number}[]=[]
  const rewritten=new HTMLRewriter().on('head base', {element(el){
    if(hasBase)return;hasBase=true
    const url=publicIconUrl(attribute(el.getAttribute('href')||''),pageUrl);if(url)base=url.href
  }}).on('head link',{element(el){
    const rel=attribute(el.getAttribute('rel')||'').toLowerCase().split(/\s+/),href=el.getAttribute('href')
    if(href && (rel.includes('icon') || rel.includes('apple-touch-icon')))icons.push({href:attribute(href),priority:rel.includes('icon')?0:1})
  }}).transform(new Response(html, {headers:{'Content-Type':'text/html; charset=utf-8'}}))
  await rewritten.text() // Input was bounded before parsing.
  for(const icon of icons.sort((a,b)=>a.priority-b.priority)){
    const url=publicIconUrl(icon.href,base);if(url)return url.href
  }
  return null
}
export async function resolveFriendIcon(raw: string) {
  let target=publicIconUrl(raw);if(!target)return null
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000)
  try {
    for(let hop=0;hop<4;hop++){
      const response=await fetch(target.href,{headers:{Accept:'text/html','User-Agent':'Blog-Friend-Icon/1.0'},redirect:'manual',signal:controller.signal})
      if(response.status>=300 && response.status<400){const location=response.headers.get('Location');await response.body?.cancel();target=location?publicIconUrl(location,target.href):null;if(!target)return null;continue}
      if(!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get('Content-Type')||'')){await response.body?.cancel();return null}
      return await readHeadIcon(await headText(response),target.href)
    }
  } catch {} finally {clearTimeout(timer)}
  return null
}
export function friendIconRoutes() {
  const app=new Hono<{Bindings:Env}>()
  app.get('/api/friend-icon/:id',async c=>{
    const page=await getPageBySlug(c,'friend-link');if(!page)return c.notFound()
    const entry=friendDocument(page.body).entries.find(row=>row.id===c.req.param('id'));if(!entry)return c.notFound()
    const target=publicIconUrl(entry.url)
    if(!target)return c.notFound()
    const fallback=new URL('/favicon.ico',target).href
    const key=new Request(new URL('/_friend-icon-cache?site='+encodeURIComponent(target.href),c.req.url))
    const cache=typeof caches==='undefined'?null:caches.default
    let icon:string|null=null
    try {const cached=await cache?.match(key);if(cached){const value=await cached.text();if(publicIconUrl(value))icon=value}} catch {}
    if(!icon){
      icon=target.origin===new URL(c.req.url).origin?SITE_ICON:await resolveFriendIcon(target.href)||fallback
      try {await cache?.put(key,new Response(icon,{headers:{'Cache-Control':'public, max-age=3600'}}))}catch{}
    }
    return new Response(null,{status:302,headers:{Location:icon,'Cache-Control':'public, max-age=3600','Referrer-Policy':'no-referrer'}})
  })
  return app
}
