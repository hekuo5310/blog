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
- 标签浏览：`/tags` 显示已发布文章的标签和文章数，点击标签可按标签精确筛选文章；草稿标签不会公开

## 安全提示

- **不要把真实密钥提交进仓库。** `ADMIN_PASS`、`OPENAI_API_KEY` 等一律通过 `wrangler secret put` 或本地 `.dev.vars`（已被 Git 忽略）配置，`wrangler.jsonc` 只保留公开配置。
- 如果某个密钥曾经出现在 Git 历史中（哪怕已删除文件），请**立即到对应平台吊销并轮换**新密钥，并考虑用 `git filter-repo` 清理历史后强推（会改变所有提交 hash，需要协作者重新克隆）。
- 管理后台已启用：管理员会话使用 `__Host-` 前缀 Cookie（生产环境）、同源校验、登录失败限流，以及 Salted 会话令牌。

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

输出中找 `database_id`，填入 `wrangler.jsonc`：

```toml
[[d1_databases]]
database_id = "你的ID"
```

### 3. 创建 KV 命名空间

```bash
wrangler kv:namespace create SESSIONS
```

输出中找 `id`，填入 `wrangler.jsonc`：

```toml
[[kv_namespaces]]
id = "你的ID"
```

### 4. 设置管理员账号

```bash
wrangler secret put ADMIN_USER   # 输入用户名
wrangler secret put ADMIN_PASS   # 输入密码
```

### 5. 迁移数据库

迁移会在部署时自动执行（见第 7 步），也可以单独先跑：

```bash
wrangler d1 migrations apply DB --remote
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
wrangler d1 migrations apply DB --local
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
  pages.ts        页面 CRUD
  html.ts         HTML 模板
  ai-summary.ts   AI 总结：抽取标记块、调用 API
  analytics.ts    匿名页面访问统计与公开报表聚合
  time.ts         UTC 与 UTC+8 时间转换
  config.ts       可选环境变量判断
migrations/
  0001_init.sql         建表
  0004_ai_summary.sql   posts 增加 ai_summary 列
  0005_post_activities.sql  文章发布与修改活动
  0006_remove_user_system.sql  删除旧用户与本地评论表
  0007_post_license.sql  文章级许可协议
  0008_custom_license.sql  自定义协议名称与正文
  0009_page_views.sql  匿名页面访问统计
  0010_page_view_country.sql  访问国家或地区代码
  0011_post_tags.sql         文章标签
  0012_query_indexes.sql     公开查询索引
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

### 离线阅读

公开页面导航中的「启用离线模式」会下载 `/offline/archive` 提供的 gzip JSON 整站包，解压到浏览器 Cache Storage。下载、解包和版本校验全部成功后才启用；失败时保持原有模式。包内包括已发布文章、公开自定义页面、首页与标签分页、归档、搜索索引、协议、RSS、Markdown 渲染脚本，以及公开正文引用的站内图片。离线搜索匹配标题和正文，最多返回 50 篇。

后台、草稿、登录会话、配置密钥和访问报表不会进入缓存。第三方图片、评论、外部链接和访问报表需要网络。离线包不枚举 R2 存储桶，只读取公开正文引用的图片；打包公开页面时不加载评论组件。生成包在 Base64 和 JSON 转义后、gzip 压缩前的 UTF-8 总量暂限 32 MiB，超过时拒绝生成，避免 Worker 内存超限。

离线模式通过 Service Worker 提供，需要 HTTPS（本地 localhost 也可）和支持 `DecompressionStream('gzip')` 的浏览器。缓存仅在当前浏览器和当前站点有效；浏览器清理站点数据或回收存储会使其失效。

版本由 Workers `VERSION` 部署 ID 和公开内容摘要组成。每次离线页面导航、恢复联网、回到页面及每分钟检查一次 `/offline/version`；发现重新部署或公开内容变化后删除离线缓存，切回在线模式并提示重新启用。完全断网期间无法获知服务器更新，继续使用已有包，联网后再检查。「切回在线模式」会清除离线包并重新通过网络加载当前页面。在线模式不自动缓存页面。

运行 `npm run check` 可执行离线回归测试、TypeScript 检查和 Wrangler 部署打包检查。

离线浏览器脚本使用 `.js.txt` 保存，由 Wrangler 默认 Text 模块规则导入为字符串，再通过 `.js` HTTP 路由提供，避免在 Worker 启动时执行浏览器代码。Marked 18.0.6 与 DOMPurify 3.4.12 的浏览器发行脚本保存在同一目录，保留原版权声明；升级依赖时同步这两份文本资源。`npm run check` 还检查 Wrangler 实际产物并验证服务器启动和四个脚本资源路由。

## ChatGPT Token 统计展示

完整配置步骤见 [ChatGPT 使用统计配置指南](docs/chatgpt-stats.md)，包含 KV、同步密钥、现有 UserScript 配置、首次同步、接口测试与常见问题。

独立页面 `/chatgpt-stats` 的「ChatGPT 使用统计」卡片展示累计 Tokens、单日峰值、最长任务、最长/当前连续天数、最近同步时间、全年逐日热力图及轻量 SVG 累计曲线。沿用博客卡片、CSS 变量和深色模式；移动端只在热力图内部横向滚动。支持 skeleton、空数据、失败重试及超过 24 小时的「统计数据可能尚未同步」提示。页面每分钟更新相对时间，每 5 分钟刷新公开数据。

### 固定接口与同步协议

- `POST /api/chatgpt-stats/update`：`Authorization: Bearer <SYNC_TOKEN>`，`Content-Type: application/json`。
- `GET /api/chatgpt-stats`：公开读取，`Cache-Control: public, max-age=300`；首次没有记录时返回 JSON `null`。
- 路由注册在 `src/index.ts`，校验/存储在 `src/chatgpt-stats.ts`，组件在 `src/chatgpt-stats-view.ts`，页面交互在 `src/chatgpt-stats-client.js.txt`，由 `src/html.ts` 的 `chatgptStatsPage` 接入独立页面；导航栏的「Token 统计」进入该页，首页不展示统计卡片。

POST 完全兼容现有 UserScript 的八个字段，无需重写同步脚本：

```json
{
  "totalTokens": 1415463545,
  "peakDailyTokens": 125716880,
  "longestTaskSeconds": 80080,
  "longestStreakDays": 14,
  "currentStreakDays": 0,
  "daily": [{"start_date":"2026-09-30","tokens":53256440,"chat_turns":0}],
  "weekly": [{"start_date":"2026-09-28","tokens":97597082,"chat_turns":0}],
  "cumulative": [{"start_date":"2026-09-30","tokens":1415463545,"chat_turns":0}]
}
```

数组按实际 Profile 活动记录结构解析：`start_date` 为合法 `YYYY-MM-DD` 日期，`tokens` 为非负有限数，`chat_turns` 为可选非负有限数；累计数组的 `tokens` 已是累计值，不再次求和。数组可为空，每个数组最多 5000 条；拒绝重复日期与未知记录字段。五项数值必须为非负有限 number。未知顶层字段（包括客户端传入的 `updatedAt`）拒绝，输入错误为 400；错误/缺失 Bearer 为 401；超过 256 KiB 请求体为 413；未配置或存储故障为 503。大小限制同时检查声明长度与实际流字节数。

KV 只保存重建后的上述八项数据以及服务器生成的 ISO 8601 `updatedAt`。博客后端不访问 ChatGPT；不存储原始 Profile、Cookie、ChatGPT Authorization、账户/设备 ID 或聊天内容。接口不记录 Authorization 或 POST body；无需 CORS 通配符，现有 `GM_xmlhttpRequest` 可直接发送。

### KV 与 Secret

`wrangler.jsonc` 已增加 `CHATGPT_STATS` 绑定，使用项目原有真实 KV namespace ID `1abb51160d5e47dbb773d8dea1b7313f`，保存键为 `profile`。复用 namespace 不新增存储 abstraction；管理员会话校验已限制为正确令牌格式和精确存储值 `1`，统计记录不会被当成会话。无需新建 KV 即可部署。若希望独立 namespace，可用下列命令创建，再把 `CHATGPT_STATS` 的 `id` 换为命令实际返回的 ID，不改 `SESSIONS`：

```bash
npx wrangler kv namespace create CHATGPT_STATS
```

已按项目安装的 Wrangler 4.111.0 帮助确认以下 Secret 命令：

```bash
npx wrangler secret put SYNC_TOKEN --config wrangler.jsonc
```

粘贴一个随机生成的高强度 Token，并在现有 UserScript 的 `SYNC_TOKEN` 常量填入完全相同的值。不要将真实 Token 放到 `vars`、README 或 Git。当前开发环境未登录 Cloudflare，Secret 需要由拥有账号登录态的用户设置；代码与 KV 绑定配置已完成。

现有 Worker 域名 `blog.hekuo.workers.dev` 已确认可访问。现有脚本中的 `YOUR_BLOG_DOMAIN`（包括 `@connect`）可填该域名，`WORKER_URL` 填：

```text
https://blog.hekuo.workers.dev/api/chatgpt-stats/update
```

若使用自定义域名，也可以把这两处同时改成该 Worker 已绑定的自定义域名。同步间隔、ChatGPT 读取接口和八个 JSON 字段保持不变。公开 GET 为 `https://blog.hekuo.workers.dev/api/chatgpt-stats`。KV 最终一致性与 GET 的 5 分钟浏览器缓存可能让刚同步的数据稍后才显示。

### 测试同步（PowerShell）

先合并并部署，再设置 Secret。以下仅写入合成测试数据；之后现有 UserScript 会覆盖它：

```powershell
$syncToken = Read-Host '输入与 Worker Secret 相同的 SYNC_TOKEN' -MaskInput
$payload = @{
  totalTokens = 1000000
  peakDailyTokens = 250000
  longestTaskSeconds = 80080
  longestStreakDays = 14
  currentStreakDays = 0
  daily = @(@{ start_date = '2026-10-03'; tokens = 250000; chat_turns = 0 })
  weekly = @()
  cumulative = @(@{ start_date = '2026-10-03'; tokens = 1000000; chat_turns = 0 })
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri 'https://blog.hekuo.workers.dev/api/chatgpt-stats/update' `
  -Headers @{ Authorization = "Bearer $syncToken" } -ContentType 'application/json' -Body $payload
Remove-Variable syncToken
Invoke-RestMethod -Uri 'https://blog.hekuo.workers.dev/api/chatgpt-stats'
```

`-MaskInput` 需要 PowerShell 7；Windows PowerShell 5.1 可用 `Read-Host -AsSecureString` 后通过 `[System.Net.NetworkCredential]::new('', $value).Password` 在本地取得字符串。GET 无需登录或 Token。正确 POST 返回 `{ "ok": true, "updatedAt": "..." }`；错误 Token 返回 401；负数、非数组、额外字段返回 400。打开 `/chatgpt-stats` 核对卡片、热力图 hover、年份切换与曲线。

验证命令为项目现有 `npm run check`（测试、TypeScript、Wrangler 实际打包及产物启动检查）；没有独立 lint/build 脚本。`jsdom` 仅用于开发测试，不进入博客浏览器运行包。新增回归测试覆盖固定客户端协议、鉴权、字节上限、敏感字段拒绝、KV 故障、会话隔离、格式、365/366 格热力图、SVG、空数据、过期和错误重试状态。

离线整站包包含 `/chatgpt-stats` 的页面外壳；统计 API 始终通过网络读取，断网时页面显示离线提示。
