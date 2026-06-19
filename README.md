# Blog

全栈博客，运行在 Cloudflare Workers。D1 存文章/评论，KV 存 session。

## 功能

- 公开前端：文章列表、文章详情、评论
- 管理后台：新建/编辑/删除/发布文章，删除评论
- 管理员登录（单账号，env secret）
- AI 总结：文章内 `[ai-summary]...[/ai-summary]` 标记的内容，发帖时一次性调用 OpenAI 协议 API 生成总结，渲染时原内容在上、AI 总结框在下

## 部署

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create blog-db
```

输出中找 `database_id`，填入 `wrangler.toml`：

```toml
[[d1_databases]]
database_id = "你的ID"
```

### 3. 创建 KV 命名空间

```bash
wrangler kv:namespace create SESSIONS
```

输出中找 `id`，填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
id = "你的ID"
```

### 4. 设置管理员账号

```bash
wrangler secret put ADMIN_USER   # 输入用户名
wrangler secret put ADMIN_PASS   # 输入密码
```

### 5. 初始化数据库

```bash
wrangler d1 execute blog-db --file=migrations/0001_init.sql
wrangler d1 execute blog-db --file=migrations/0002_users.sql
wrangler d1 execute blog-db --file=migrations/0003_pages.sql
wrangler d1 execute blog-db --file=migrations/0004_ai_summary.sql
```

### 6. 配置 AI 总结（可选）

总结调用 OpenAI 协议兼容的 chat completions 接口。`OPENAI_BASE_URL` 与 `OPENAI_MODEL` 已在 `wrangler.toml` 的 `[vars]` 中给出默认值，按需改成你的服务商（如 DeepSeek、Moonshot、本地部署等）。

部署环境设置 API key：

```bash
wrangler secret put OPENAI_API_KEY
```

本地开发：在项目根目录建 `.dev.vars` 文件：

```
OPENAI_API_KEY=sk-...
```

不配置 key 时，文章仍可正常保存，只是不生成 AI 总结。

### 7. 部署

```bash
wrangler deploy
```

## 本地开发

```bash
wrangler d1 execute blog-db --local --file=migrations/0001_init.sql
wrangler d1 execute blog-db --local --file=migrations/0002_users.sql
wrangler d1 execute blog-db --local --file=migrations/0003_pages.sql
wrangler d1 execute blog-db --local --file=migrations/0004_ai_summary.sql
wrangler dev
```

本地访问 `http://localhost:8787`，管理后台 `/admin/login`。

## AI 总结用法

在文章 Markdown 正文中用 `[ai-summary]` 和 `[/ai-summary]` 包裹要总结的内容，可有多块：

```
正文段落……

[ai-summary]
这里是一段较长、想让 AI 总结的内容……
[/ai-summary]

更多正文……
```

保存文章时一次性调用 API 生成每块的总结并入库，之后渲染不再调用。编辑时若标记块内容未变则复用已有总结，变了才重新生成。

## 文件结构

```
src/
  index.ts        路由入口
  auth.ts         session 管理
  posts.ts        文章 CRUD
  comments.ts     评论
  html.ts         HTML 模板
  ai-summary.ts   AI 总结：抽取标记块、调用 API
migrations/
  0001_init.sql         建表
  0004_ai_summary.sql   posts 增加 ai_summary 列
wrangler.toml           Workers 配置
```
