# Blog

全栈博客，运行在 Cloudflare Workers。D1 存文章与页面，KV 存管理员 session 和站点配置。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/hekuo5310/blog)

## 一键部署（Deploy to Cloudflare）

点击上方按钮即可在**自己的 Cloudflare 账号**上部署一份：

1. 登录 Cloudflare，按钮会引导你选择账号、设置项目名
2. 填写管理员账号（`ADMIN_USER` / `ADMIN_PASS`）——**唯一必填项**
3. Cloudflare 自动完成：clone 仓库 → 创建 D1 数据库、KV 命名空间、R2 存储桶并绑定 → 执行数据库迁移 → 构建部署
4. 部署完成后访问分配的 `*.workers.dev` 域名，`/admin/login` 进入后台

无需修改任何代码或配置，只需要管理员账号密码即可运行。可选功能（AI 总结、Giscus 评论）默认不启用——**不需要的话保留当前内容即可，无需任何操作**；需要时部署后再启用：

```bash
# AI 文章总结（OpenAI 协议兼容，如 DeepSeek）
wrangler secret put OPENAI_API_KEY

# Giscus 评论（GitHub Discussions）
wrangler secret put GISCUS_REPO_ID
wrangler secret put GISCUS_CATEGORY
wrangler secret put GISCUS_CATEGORY_ID
```

> 说明：Deploy to Cloudflare 配置页只会要求填写 `.dev.vars.example` 中声明的必填项（管理员账号）；可选变量未在配置中声明，不会被要求填写，也不需要改动。

## 功能

- 公开前端：文章列表、站内搜索、文章详情、正文右侧章节导航、阅读进度与阅读时间、复制文章链接、RSS 订阅、Giscus 评论
- 管理后台：新建/编辑/删除/发布文章与页面
- 文章路径可自定义；新建时留空才会根据标题自动生成拼音路径，重复路径自动追加数字
- 管理员登录（单账号，env secret）
- 无公开用户系统，评论身份验证由 GitHub/Giscus 提供
- AI 总结：文章内 `[ai-summary]...[/ai-summary]` 标记的内容，发帖时一次性调用 OpenAI 协议 API 生成总结，渲染时原内容在上、AI 总结框在下
- 全年文章活动墙：记录公开文章的发布和真实修改，点击日期可查看具体改动
- 公开访问报表：展示访问趋势、热门页面、来源域名和设备类型，不保存 IP 或访客标识
- 时间统一按 UTC+8（Asia/Shanghai）展示，数据库仍使用 UTC 保存
- 安全渲染：Markdown 经 DOMPurify 清洗，草稿仅后台可见，管理员登录带失败次数限制
- 健康检查：`/healthz`
- 搜索与收录：`/search` 搜索标题和正文；自动生成 `/robots.txt` 与 `/sitemap.xml`，便于搜索引擎发现公开内容

## 部署

项目首次收到请求时会自动检查并执行内置数据库迁移；已有站点升级到标签功能时无需手动执行 `0011_post_tags.sql`。

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
wrangler d1 execute blog-db --file=migrations/0005_post_activities.sql
wrangler d1 execute blog-db --file=migrations/0006_remove_user_system.sql
wrangler d1 execute blog-db --file=migrations/0007_post_license.sql
wrangler d1 execute blog-db --file=migrations/0008_custom_license.sql
wrangler d1 execute blog-db --file=migrations/0009_page_views.sql
wrangler d1 execute blog-db --file=migrations/0010_page_view_country.sql
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
npm run deploy
```

`deploy` 脚本会先执行数据库迁移（`wrangler d1 migrations apply DB --remote`）再部署 Worker，幂等，重复执行安全。

> **已有部署升级到本版本**：如果你之前手动执行过 0001-0010 的 SQL（`wrangler d1 execute` 方式），`d1_migrations` 表中没有记录，`npm run deploy` 会尝试重跑这些迁移而报错。首次升级时先手动标记已执行的迁移：
>
> ```bash
> wrangler d1 execute blog-db --remote --command "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
> wrangler d1 execute blog-db --remote --command "INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_init'),('0002_users'),('0003_pages'),('0004_ai_summary'),('0005_post_activities'),('0006_remove_user_system'),('0007_post_license'),('0008_custom_license'),('0009_page_views'),('0010_page_view_country')"
> ```
>
> 标记完成后 `npm run deploy` 即可正常增量执行后续迁移。

## 本地开发

```bash
wrangler d1 execute blog-db --local --file=migrations/0001_init.sql
wrangler d1 execute blog-db --local --file=migrations/0002_users.sql
wrangler d1 execute blog-db --local --file=migrations/0003_pages.sql
wrangler d1 execute blog-db --local --file=migrations/0004_ai_summary.sql
wrangler d1 execute blog-db --local --file=migrations/0005_post_activities.sql
wrangler d1 execute blog-db --local --file=migrations/0006_remove_user_system.sql
wrangler d1 execute blog-db --local --file=migrations/0007_post_license.sql
wrangler d1 execute blog-db --local --file=migrations/0008_custom_license.sql
wrangler d1 execute blog-db --local --file=migrations/0009_page_views.sql
wrangler d1 execute blog-db --local --file=migrations/0010_page_view_country.sql
npm run dev
```

本地访问 `http://localhost:8787`，管理后台 `/admin/login`。

提交前可运行完整检查：

```bash
npm run check
```

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

## 文章协议

新建或编辑文章时可单独选择许可协议，未选择时默认使用 `CC BY 4.0`。支持六种 CC 协议的 1.0、2.0、2.5、3.0、4.0 版本、CC0 1.0、常见软件开源协议、“保留所有权利”和自定义协议；文章详情页会显示当前协议，已发布文章修改协议或自定义条款时也会计入文章活动墙。

## 自定义文章路径

新建文章时，“文章路径”可以留空，此时会根据标题生成拼音路径。手动填写时只保留小写英文字母、数字和连字符，例如填写 `my-first-post` 后，文章地址为 `/post/my-first-post`。编辑文章时默认保留当前路径；主动清空后保存会根据当前标题重新生成拼音路径。修改已发布文章的路径会改变其公开 URL 和 Giscus 的 `pathname` 映射。

## 文件结构

```
src/
  index.ts        路由入口
  auth.ts         session 管理
  posts.ts        文章 CRUD
  html.ts         HTML 模板
  ai-summary.ts   AI 总结：抽取标记块、调用 API
  analytics.ts    匿名页面访问统计与公开报表聚合
  time.ts         UTC 与 UTC+8 时间转换
migrations/
  0001_init.sql         建表
  0004_ai_summary.sql   posts 增加 ai_summary 列
  0005_post_activities.sql  文章发布与修改活动
  0006_remove_user_system.sql  删除旧用户与本地评论表
  0007_post_license.sql  文章级许可协议
  0008_custom_license.sql  自定义协议名称与正文
  0009_page_views.sql  匿名页面访问统计
  0010_page_view_country.sql  访问国家或地区代码
wrangler.jsonc          云端部署配置（不含密钥）
wrangler.toml           本地配置（Git 忽略）
```

## RSS 订阅

RSS 订阅地址为：

```text
https://你的域名/rss.xml
```

也兼容 `https://你的域名/feed.xml`。将地址复制到 Feedly、Inoreader、Follow 等 RSS 阅读器即可订阅公开文章更新。

## 搜索与站点地图

- 站内搜索：`https://你的域名/search`，可搜索已发布文章的标题和正文，单次最多返回 50 篇结果。
- `https://你的域名/robots.txt` 会允许公开内容抓取并指向站点地图。
- `https://你的域名/sitemap.xml` 会列出首页、已发布文章和已发布页面；访问地址时会按当前域名自动生成，无需额外配置。

## 访问报表

公开报表地址为 `/stats`，也可通过首页顶部的“访问报表”按钮进入。页面默认显示最近 24 小时，可切换最近 7 天、30 天或 90 天；24 小时趋势按 UTC+8 小时汇总，其余范围按 UTC+8 自然日汇总。页面每 5 秒请求一次 `/stats.json` 并原地刷新当前范围，包括访问趋势、热门页面、外部来源域名、访客国家或地区和设备类型。

统计仅保存 Cloudflare 根据访问 IP 提供的两位国家或地区代码，不保存 IP 地址、完整 User-Agent 或访客标识，不使用分析 Cookie，并过滤常见爬虫、浏览器预取请求以及 `/stats`、`/stats.json` 报表请求。浏览器发送 `DNT: 1` 或 `Sec-GPC: 1` 时不会记录该次访问，因此报表展示的是页面访问次数，不是独立访客人数。

## 折叠内容

在 Markdown 中使用以下语法创建默认折叠的内容：

```text
[details="标题"]
这里是折叠的 Markdown 内容。
[/details]
```

页面会显示一个小箭头和双引号中的标题，点击后展开正文。

## Giscus 评论配置

本站文章评论使用 Giscus，评论内容会存储在 GitHub Discussions 中。配置前请准备一个公开的 GitHub 仓库，并在仓库的 `Settings -> Features` 中开启 `Discussions`。

### 1. 安装 Giscus App

打开 [github.com/apps/giscus](https://github.com/apps/giscus)，将 Giscus 安装到存放评论的仓库。建议只授权这个博客仓库，减少不必要的权限。

### 2. 获取 Giscus 配置值

访问 [giscus.app](https://giscus.app/zh-CN)，依次填写仓库和 Discussion 分类。仓库应填写为 `用户名/仓库名`，例如：

```text
hekuo5310/blog
```

在页面底部生成配置后，记录以下三个值：

- `data-repo-id` 对应 `GISCUS_REPO_ID`
- `data-category` 对应 `GISCUS_CATEGORY`
- `data-category-id` 对应 `GISCUS_CATEGORY_ID`

本项目默认使用 `pathname` 将文章 URL 映射到 Discussion，也就是每篇文章对应一个独立的讨论。需要使用其他映射方式时，可设置 `GISCUS_MAPPING`。

### 3. 配置 Cloudflare Workers

将下面的变量加入 `wrangler.toml` 的 `[vars]` 部分。ID 必须使用 Giscus 页面生成的真实值，不要保留示例值：

```toml
[vars]
GISCUS_REPO = "用户名/仓库名"
GISCUS_REPO_ID = "R_kgDOxxxxxxxx"
GISCUS_CATEGORY = "Announcements"
GISCUS_CATEGORY_ID = "DIC_kwDOxxxxxxxx"
GISCUS_MAPPING = "pathname"
GISCUS_LANG = "zh-CN"
```

也可以在部署时通过命令行设置变量：

```bash
wrangler secret put GISCUS_REPO_ID
wrangler secret put GISCUS_CATEGORY
wrangler secret put GISCUS_CATEGORY_ID
```

这三个值本身不是密码，使用 `[vars]` 配置更直观；如果不希望它们出现在配置文件中，也可以使用上面的 secret 命令。`GISCUS_REPO`、`GISCUS_MAPPING` 和 `GISCUS_LANG` 为可选项，默认值分别是 `hekuo5310/blog`、`pathname` 和 `zh-CN`。

### 4. 本地开发配置

在项目根目录的 `.dev.vars` 中加入本地测试所需的值：

```text
GISCUS_REPO=用户名/仓库名
GISCUS_REPO_ID=R_kgDOxxxxxxxx
GISCUS_CATEGORY=Announcements
GISCUS_CATEGORY_ID=DIC_kwDOxxxxxxxx
GISCUS_MAPPING=pathname
GISCUS_LANG=zh-CN
```

然后启动开发服务器：

```bash
npm run dev
```

打开任意公开文章，在文章底部看到 Giscus 评论框即表示配置成功。未配置 `GISCUS_REPO_ID`、`GISCUS_CATEGORY` 或 `GISCUS_CATEGORY_ID` 时，页面会显示配置提示，不会加载评论框。

### 常见问题

- 评论框显示 `Discussion not found`：检查仓库是否公开、是否开启 Discussions、Giscus App 是否已安装，并重新复制三个 ID。
- 登录后无法评论：Giscus 使用 GitHub 登录，需确认当前账号对仓库有发表评论的权限。
- 每篇文章没有独立评论：确认 `GISCUS_MAPPING` 为 `pathname`，并确保文章 URL 稳定。
