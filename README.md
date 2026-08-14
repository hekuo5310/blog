# Blog

一个运行在 Cloudflare Workers 上的轻量全栈个人博客。

- Hono + TypeScript
- Cloudflare D1：文章、页面、访问统计
- Cloudflare KV：管理员 session、站点配置
- Cloudflare R2：文章图片
- Markdown + DOMPurify 安全渲染
- RSS、Sitemap、Robots、站内搜索
- Giscus 评论
- AI 总结与文章润色（OpenAI-compatible API）
- 公开访问统计与文章活动墙
- 深色模式、移动端适配、文章目录、阅读进度

## 部署

### 1. 安装

```bash
npm ci
```

### 2. 配置 Cloudflare

项目使用 `wrangler.jsonc`，不是 `wrangler.toml`。

创建资源：

```bash
wrangler d1 create blog-db
wrangler kv namespace create SESSIONS
wrangler r2 bucket create blog-images
```

把返回的 D1/KV ID 填入 `wrangler.jsonc`。

### 3. 设置密钥

管理员账号和密码必须使用 Worker Secret：

```bash
wrangler secret put ADMIN_USER
wrangler secret put ADMIN_PASS
```

AI 功能可选：

```bash
wrangler secret put OPENAI_API_KEY
```

不要把 API key、管理员密码等秘密写进 `wrangler.jsonc`、源码或 Git。

### 4. 初始化 D1

按顺序执行全部迁移：

```bash
for file in migrations/*.sql; do
  wrangler d1 execute blog-db --remote --file="$file"
done
```

如果已有旧站点，请先确认数据库已经执行到 `0011_post_tags.sql`，再执行 `0012_query_indexes.sql`。

### 5. 部署

```bash
npm run check
npm run deploy
```

## 本地开发

```bash
npm ci
npm run dev
```

本地 AI 密钥放在根目录 `.dev.vars`：

```text
OPENAI_API_KEY=sk-...
```

`.dev.vars` 已加入 Git 忽略规则，不应提交。

## 常用命令

```bash
npm run dev       # 本地开发
npm run typecheck # TypeScript 类型检查
npm run check     # 类型检查 + Wrangler dry-run
npm run deploy    # 部署 Worker
```

GitHub Actions 会在 `main` push 和 Pull Request 上自动执行 `npm run check`。

## 主要功能

### 文章

文章支持自定义 slug、自动拼音 slug、标签、文章级许可协议、AI 总结和 Markdown。发布后的文章修改会记录在首页活动墙。

### 页面

支持独立页面 `/p/:slug`，页面 slug 会自动避免重复。

### 图片

图片上传到 R2，并通过 `/images/*` 提供。删除文章或修改正文时，只会删除已经没有其他文章或页面引用的图片，避免误删共享图片。

### AI

`[ai-summary]...[/ai-summary]` 会在保存文章时调用一次 AI 生成总结；编辑时内容未改变则复用已有总结。

AI 请求具有输入长度限制和超时保护，AI 服务异常不会阻止没有 AI 总结的普通文章保存。

### 搜索与收录

- `/search`：搜索已发布文章标题和正文
- `/archive`：文章归档
- `/rss.xml`、`/feed.xml`：RSS
- `/robots.txt`：搜索引擎抓取规则
- `/sitemap.xml`：自动生成站点地图
- `/healthz`：D1 健康检查

### 访问统计

`/stats` 提供最近 24 小时、7 天、30 天和 90 天统计。

统计不会保存 IP 地址或独立访客标识，只保存页面路径、外部来源域名、设备类型、访问时间和 Cloudflare 提供的两位国家/地区代码。发送 `DNT: 1` 或 `Sec-GPC: 1` 的请求不会计入统计。

## Giscus

评论需要配置：

```text
GISCUS_REPO
GISCUS_REPO_ID
GISCUS_CATEGORY
GISCUS_CATEGORY_ID
GISCUS_MAPPING
GISCUS_LANG
```

其中 `GISCUS_REPO_ID`、`GISCUS_CATEGORY`、`GISCUS_CATEGORY_ID` 来自 Giscus 配置页面。默认映射方式为 `pathname`。

## 安全措施

当前项目包含：

- HttpOnly + SameSite Strict 管理员 session
- HTTPS 下使用 `__Host-` session cookie
- 管理后台请求的 Origin/Referer 同源校验，防止 CSRF
- 登录失败次数限制
- Markdown 输出经过 DOMPurify 清洗
- R2 图片路径校验
- 图片删除前检查其他内容引用
- AI 请求大小限制和超时
- 公共页面与管理后台分离
- 健康检查不缓存

## 数据库迁移

```text
0001_init.sql
0002_users.sql
0003_pages.sql
0004_ai_summary.sql
0005_post_activities.sql
0006_remove_user_system.sql
0007_post_license.sql
0008_custom_license.sql
0009_page_views.sql
0010_page_view_country.sql
0011_post_tags.sql
0012_query_indexes.sql
```

`0012_query_indexes.sql` 为查询性能优化，增加文章、页面和访问统计常用索引。

## 项目结构

```text
src/
  index.ts        Worker 路由入口
  auth.ts         管理员 session 与请求来源校验
  posts.ts        文章 CRUD、slug、标签与活动记录
  pages.ts        页面 CRUD 与 slug
  html.ts         HTML/CSS/客户端脚本模板
  images.ts       R2 图片上传、读取与安全删除
  ai-summary.ts   AI 总结与润色
  analytics.ts    匿名访问统计
  licenses.ts     文章许可协议
  time.ts         时间转换

migrations/       D1 数据库迁移
wrangler.jsonc    Cloudflare Workers 配置
package.json      开发、检查与部署脚本
.github/          GitHub Actions CI
```

## License

仓库根目录的 `LICENSE` 为项目代码许可证。文章使用的许可协议以文章详情页标注为准。
