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
