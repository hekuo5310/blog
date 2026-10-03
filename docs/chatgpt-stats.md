# ChatGPT 使用统计配置指南

这份指南用于当前博客已有的统计功能。仓库提供完整的 **ChatGPT Profile Stats Sync** Tampermonkey 脚本；已有该脚本的用户可继续使用，无需修改同步协议或新建服务。

配置完成后，从博客导航栏的「Token 统计」进入独立页面：

<https://www.io.hk.cn/chatgpt-stats>

页面展示累计 Tokens、单日峰值、最长任务、最长/当前连续天数、最近同步时间、逐日热力图和累计曲线。

## 1. 确认博客部署与 KV

先在博客仓库目录安装依赖：

```bash
npm ci
```

使用博客现有的 Cloudflare 部署流程部署当前 main。如果在本地部署，先登录自己的 Cloudflare 账号，再运行项目已有命令：

```bash
npx wrangler login
npm run deploy
```

`npm run deploy` 会应用已有 D1 migrations 并部署博客 Worker。使用 Cloudflare 自动部署时，无需再执行一次本地部署。

当前实际配置文件是 `wrangler.jsonc`，Worker 名称为 `blog`。它已经包含 KV binding `CHATGPT_STATS`，复用原有 `SESSIONS` 的真实 namespace，统计记录保存在键 `profile`，**无需额外创建 KV**。

如希望单独存储统计，可执行：

```bash
npx wrangler kv namespace create CHATGPT_STATS
```

将命令返回的真实 namespace ID 填入 `wrangler.jsonc` 中 `CHATGPT_STATS` 的 `id`，然后重新部署。只改该 binding，不改 `SESSIONS`。不要填写示例或猜测的 ID。

## 2. 设置同步密钥

自行生成一个高强度随机值，例如在本机执行以下命令生成 32 字节随机值：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

保存该值，接下来 Worker 和 UserScript 必须使用同一个值。不要将它提交到 Git、填入 `wrangler.jsonc` 的 `vars` 或贴到公开文档。

在仓库目录执行：

```bash
npx wrangler secret put SYNC_TOKEN --config wrangler.jsonc
```

按提示粘贴刚生成的值。命令已按项目安装的 Wrangler 4.111.0 帮助确认；需要拥有该 Worker 的 Cloudflare 登录态。也可以在 Cloudflare 控制台找到 `blog` Worker，在设置中的变量和密钥处新增名为 `SYNC_TOKEN` 的 **Secret** 并应用。

这是博客自己的同步密钥，不是 ChatGPT 的 Cookie 或 Authorization。

## 3. 安装并配置 Tampermonkey 脚本

没有脚本的用户可以直接使用仓库提供的完整版本：

- [查看完整脚本](../scripts/chatgpt-profile-stats-sync.user.js)
- [安装脚本（Raw）](https://github.com/hekuo5310/blog/raw/refs/heads/main/scripts/chatgpt-profile-stats-sync.user.js)

先在浏览器安装并启用 Tampermonkey，再打开上面的 Raw 链接并按提示安装。如果没有出现安装界面，可打开「查看完整脚本」，复制全部代码，在 Tampermonkey 控制台选择「添加新脚本」，替换默认内容后保存。若扩展提示需要开启用户脚本权限，按浏览器提示启用。

安装后，在 Tampermonkey 中编辑脚本，将 `REPLACE_WITH_YOUR_SYNC_TOKEN` 替换为第 2 步的 Secret。附带脚本默认同步用户名 `hekuo5310`，发送到本站 `https://www.io.hk.cn/api/chatgpt-stats/update`；其他用户需修改为自己的 ChatGPT 用户名及自己部署的博客地址。不要向他人的博客发送自己的统计或密钥，也不要重复安装多个版本。

脚本沿用原有 Profile 请求、八个 JSON 字段和 30 分钟同步间隔，不会把 ChatGPT Cookie 或 Authorization 发给博客。

完整脚本如下（与仓库中的 `.user.js` 文件一致）：

```javascript
// ==UserScript==
// @name         ChatGPT Profile Stats Sync
// @namespace    https://zerexa.net/
// @version      1.0.0
// @description  Sync my ChatGPT token statistics to my blog
// @match        https://chatgpt.com/*
// @grant        GM_xmlhttpRequest
// @connect      www.io.hk.cn
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const USERNAME = "hekuo5310";

  const WORKER_URL =
    "https://www.io.hk.cn/api/chatgpt-stats/update";

  const SYNC_TOKEN =
    "REPLACE_WITH_YOUR_SYNC_TOKEN";

  const SYNC_INTERVAL = 30 * 60 * 1000;

  async function sync() {
    try {
      const lastSync = Number(
        localStorage.getItem("zerexa-chatgpt-last-sync") || 0
      );

      if (Date.now() - lastSync < SYNC_INTERVAL) {
        return;
      }

      const response = await fetch(
        `/backend-api/profiles/${USERNAME}/page?personal=false`,
        {
          method: "GET",
          credentials: "include"
        }
      );

      if (!response.ok) {
        console.error(
          "[ChatGPT Stats] Profile request failed:",
          response.status
        );
        return;
      }

      const data = await response.json();

      const page = data?.page;
      const stats = page?.stats;
      const agentic = stats?.agentic;
      const graph = page?.activity_graph;

      if (!agentic) {
        console.error(
          "[ChatGPT Stats] Unexpected response:",
          data
        );
        return;
      }

      const payload = {
        totalTokens:
          agentic.lifetime_tokens ?? 0,

        peakDailyTokens:
          agentic.peak_daily_tokens ?? 0,

        longestTaskSeconds:
          agentic.longest_running_turn_sec ?? 0,

        longestStreakDays:
          stats.longest_streak_days ?? 0,

        currentStreakDays:
          stats.current_streak_days ?? 0,

        daily:
          graph?.daily_usage_buckets ?? [],

        weekly:
          graph?.weekly_usage_buckets ?? [],

        cumulative:
          graph?.cumulative_daily_usage_buckets ?? []
      };

      GM_xmlhttpRequest({
        method: "POST",
        url: WORKER_URL,

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SYNC_TOKEN}`
        },

        data: JSON.stringify(payload),

        onload(res) {
          if (res.status >= 200 && res.status < 300) {
            localStorage.setItem(
              "zerexa-chatgpt-last-sync",
              String(Date.now())
            );

            console.log(
              "[ChatGPT Stats] Synced successfully"
            );
          } else {
            console.error(
              "[ChatGPT Stats] Upload failed:",
              res.status,
              res.responseText
            );
          }
        },

        onerror(error) {
          console.error(
            "[ChatGPT Stats] Worker request failed:",
            error
          );
        }
      });

    } catch (error) {
      console.error(
        "[ChatGPT Stats] Sync error:",
        error
      );
    }
  }

  setTimeout(sync, 5000);

  setInterval(sync, SYNC_INTERVAL);
})();
```

脚本中需要核对的配置：

| 位置 | 填写内容 |
| --- | --- |
| `@connect YOUR_BLOG_DOMAIN` | `@connect 地址` |
| `WORKER_URL` | `https://地址/api/chatgpt-stats/update` |
| `SYNC_TOKEN` | 第 2 步设置到 Worker Secret 的同一个值 |
| `USERNAME` | GPT username |

对应的配置片段如下，直接在原脚本中替换，不另装一套同步脚本：

```javascript
// @connect      地址

const WORKER_URL =
  "https://地址/api/chatgpt-stats/update";

const SYNC_TOKEN =
  "在这里填写与 Worker Secret 相同的值";
```

`@connect` 必须位于原脚本顶部的 UserScript 元数据块内。保存脚本并确认 Tampermonkey 已启用它。

如果使用博客已绑定的自定义域名，把 `@connect` 的域名和 `WORKER_URL` 的域名同时改为该域名；路径仍为 `/api/chatgpt-stats/update`。统计页面与公开 GET 也使用同一个博客域名。

## 4. 完成首次同步

1. 在装有该脚本的浏览器中登录 <https://chatgpt.com/>。
2. 刷新 ChatGPT 页面，脚本在加载后约 5 秒尝试同步。
3. 在开发者工具 Console 中确认出现 `[ChatGPT Stats] Synced successfully`。
4. 打开博客的「Token 统计」页面查看结果。

现有脚本每 30 分钟检查一次同步。它使用 ChatGPT 站点 localStorage 中的 `zerexa-chatgpt-last-sync` 判断是否需要上传；刚同步成功后刷新页面不会立即重复上传。需要立即再试时，可在 **ChatGPT 页面**的 Console 执行以下命令，再刷新页面：

```javascript
localStorage.removeItem("zerexa-chatgpt-last-sync");
```

脚本只在 ChatGPT 页面运行。关闭页面或浏览器后不会继续定时同步，后台标签页也可能受浏览器定时器节流影响。

## 5. 测试公开 GET

浏览器直接打开：

<https://地址/api/chatgpt-stats>

无需登录，也无需携带密钥。还可以运行：

```bash
curl -i https://地址/api/chatgpt-stats
```

首次未同步时返回 HTTP 200 和 JSON `null`。同步成功后返回八项统计字段及服务器生成的 `updatedAt`，例如 `2026-10-03T10:30:00.000Z`。

响应使用 `Cache-Control: public, max-age=300`。浏览器缓存和 KV 最终一致性可能让刚上传的记录稍后才显示；等待几分钟后再检查。页面每 5 分钟刷新数据，每分钟更新相对时间。

## 6. 手动测试 POST（可选）

以下 **PowerShell 7** 命令会用合成数据覆盖当前公开统计；下一次 UserScript 同步会恢复真实数据。只在需要验证接口时执行。

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

try {
  Invoke-RestMethod -Method Post `
    -Uri 'https://地址/api/chatgpt-stats/update' `
    -Headers @{ Authorization = "Bearer $syncToken" } `
    -ContentType 'application/json' -Body $payload
} finally {
  Remove-Variable syncToken
}

Invoke-RestMethod -Uri 'https://地址/api/chatgpt-stats'
```

正确 POST 返回 HTTP 200 和 `{ "ok": true, "updatedAt": "..." }`。不需要在测试请求中携带任何 ChatGPT 登录凭据。

## 7. 接口协议与常见问题

POST 地址：`/api/chatgpt-stats/update`。请求头必须包含：

```text
Content-Type: application/json
Authorization: Bearer <SYNC_TOKEN>
```

请求 JSON 必须包含原脚本的八个字段，字段名不变：

| 字段 | 要求 |
| --- | --- |
| `totalTokens` | 非负、有限 number |
| `peakDailyTokens` | 非负、有限 number |
| `longestTaskSeconds` | 非负、有限 number，单位秒 |
| `longestStreakDays` | 非负、有限 number |
| `currentStreakDays` | 非负、有限 number |
| `daily` | array，可为空 |
| `weekly` | array，可为空 |
| `cumulative` | array，可为空 |

活动记录按已检查的 Profile 数据结构处理：`start_date` 是有效 `YYYY-MM-DD` 日期，`tokens` 是非负有限 number，`chat_turns` 是可选的非负有限 number。每个数组最多 5000 条，同一数组不能有重复日期。`cumulative` 的 Token 已经是累计值，不需要再求和。

服务端拒绝额外顶层字段、未知记录字段及客户端传入的 `updatedAt`；时间由服务器自行生成。请求体上限为 256 KiB。

| 现象 | 检查方法 |
| --- | --- |
| POST 401 | Worker Secret 与脚本中的值是否完全一致，是否包含正确 Bearer 请求头 |
| POST 400 | 是否为 JSON，八个字段是否齐全，数值/数组/日期是否符合要求，是否带有额外字段 |
| POST 413 | 请求体是否超过 256 KiB；不要上传原始 Profile 响应 |
| POST/GET 503 | `CHATGPT_STATS` 是否正确绑定；POST 还要检查 `SYNC_TOKEN` 是否已设置，或稍后重试存储故障 |
| GET 返回 `null` | 尚无成功同步记录，先检查脚本 Console 中的同步结果 |
| `Profile request failed` 或 `Unexpected response` | 检查浏览器 ChatGPT 登录状态、用户名及当前 Profile 接口返回；这是浏览器读取阶段失败 |
| `Worker request failed` | 检查博客地址、网络、Tampermonkey 的 `@connect` 和请求授权 |
| 页面显示旧值 | 等待 KV 同步与 5 分钟公开 API 缓存刷新 |
| 「统计数据可能尚未同步」 | 上次同步超过 24 小时；打开 ChatGPT 页面让现有脚本再次同步 |

离线包包含统计页面外壳，统计 API 仍通过网络读取。断网时页面显示离线提示，不会将旧统计伪装成刚同步的数据。

## 8. 数据与代码位置

ChatGPT Cookie 仅留在自己的浏览器。Profile API 仅由现有 UserScript 使用浏览器登录态调用；脚本提取统计字段，再用博客同步密钥 POST 给 Worker。Worker 只把统计字段和 `updatedAt` 写入 KV，由公开 GET 提供展示。

博客后端不代理 ChatGPT，不保存 ChatGPT Cookie、Authorization、账户/设备 ID、聊天内容或原始 Profile 响应。统计接口不记录 Authorization 或完整 POST body。

| 文件 | 用途 |
| --- | --- |
| `src/index.ts` | 两个 API 路由及 `/chatgpt-stats` 页面路由 |
| `src/chatgpt-stats.ts` | 鉴权、输入校验、KV 读写 |
| `src/html.ts` | 独立统计页面与导航入口 |
| `src/chatgpt-stats-view.ts` | 统计卡片及样式 |
| `src/chatgpt-stats-client.js.txt` | 博客页面加载、热力图、累计曲线与状态处理 |
| `wrangler.jsonc` | `CHATGPT_STATS` binding；实际密钥通过 Secret 管理 |

修改实现后，可运行项目已有的 `npm run check`，涵盖测试、TypeScript 检查、Wrangler 打包及产物启动检查。项目没有独立的 lint 或 build 脚本。
