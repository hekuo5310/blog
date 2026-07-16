# Blog

全栈博客，运行在 Cloudflare Workers。D1 存文章与页面，KV 存管理员 session 和站点配置。

## 功能

- 公开前端：文章列表、文章详情、RSS 订阅、Giscus 评论
- 管理后台：新建/编辑/删除/发布文章与页面
- 管理员登录（单账号，env secret）
- 无公开用户系统，评论身份验证由 GitHub/Giscus 提供
- AI 总结：文章内 `[ai-summary]...[/ai-summary]` 标记的内容，发帖时一次性调用 OpenAI 协议 API 生成总结，渲染时原内容在上、AI 总结框在下
- 全年文章活动墙：记录公开文章的发布和真实修改，点击日期可查看具体改动

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
wrangler d1 execute blog-db --file=migrations/0005_post_activities.sql
wrangler d1 execute blog-db --file=migrations/0006_remove_user_system.sql
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
wrangler d1 execute blog-db --local --file=migrations/0005_post_activities.sql
wrangler d1 execute blog-db --local --file=migrations/0006_remove_user_system.sql
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
  html.ts         HTML 模板
  ai-summary.ts   AI 总结：抽取标记块、调用 API
migrations/
  0001_init.sql         建表
  0004_ai_summary.sql   posts 增加 ai_summary 列
  0005_post_activities.sql  文章发布与修改活动
  0006_remove_user_system.sql  删除旧用户与本地评论表
wrangler.toml           Workers 配置
```

## RSS 订阅

RSS 订阅地址为：

```text
https://你的域名/rss.xml
```

也兼容 `https://你的域名/feed.xml`。将地址复制到 Feedly、Inoreader、Follow 等 RSS 阅读器即可订阅公开文章更新。

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
