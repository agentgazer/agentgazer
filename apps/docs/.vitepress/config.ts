import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AgentGazer",
  description: "From Observability to Control - The Missing Layer for AI Agents",

  // Ignore localhost links (they're valid for local development docs)
  ignoreDeadLinks: [/^http:\/\/localhost/],

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    // PostHog Analytics
    [
      "script",
      {},
      `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
      posthog.init('phc_EBLBvuDSRBMn7yZ0bxqaE9N3SG6aMp5Q99gadigVoOL',{api_host:'https://us.i.posthog.com', person_profiles: 'identified_only'})`,
    ],
  ],

  themeConfig: {
    logo: {
      light: "/logo.svg",
      dark: "/logo.svg",
    },
    siteTitle: "AgentGazer",
    socialLinks: [
      { icon: "github", link: "https://github.com/agentgazer/agentgazer" },
    ],
    search: {
      provider: "local",
    },
  },

  locales: {
    en: {
      label: "English",
      lang: "en",
      link: "/en/",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/en/guide/getting-started" },
          { text: "API Reference", link: "/en/reference/api" },
        ],
        sidebar: {
          "/en/guide/": [
            {
              text: "Introduction",
              items: [
                { text: "Overview", link: "/en/guide/overview" },
                { text: "Getting Started", link: "/en/guide/getting-started" },
                { text: "CLI Reference", link: "/en/guide/cli" },
              ],
            },
            {
              text: "Core Concepts",
              items: [
                { text: "Proxy", link: "/en/guide/proxy" },
                { text: "Dashboard", link: "/en/guide/dashboard" },
                { text: "Provider Keys", link: "/en/guide/providers" },
                { text: "Alerts", link: "/en/guide/alerts" },
                { text: "Multi-Agent Setup", link: "/en/guide/multi-agent" },
              ],
            },
            {
              text: "Governance",
              items: [
                { text: "Security Shield", link: "/en/guide/security" },
                { text: "Kill Switch", link: "/en/guide/kill-switch" },
                { text: "Model Override", link: "/en/guide/model-override" },
                { text: "Rate Limiting", link: "/en/guide/rate-limiting" },
              ],
            },
            {
              text: "Deployment",
              items: [
                { text: "Docker", link: "/en/guide/docker" },
              ],
            },
            {
              text: "Integration",
              items: [
                { text: "OpenClaw", link: "/en/guide/openclaw" },
                { text: "MCP Server", link: "/en/guide/mcp" },
              ],
            },
            {
              text: "Help",
              items: [{ text: "FAQ", link: "/en/guide/faq" }],
            },
          ],
          "/en/reference/": [
            {
              text: "Reference",
              items: [{ text: "API", link: "/en/reference/api" }],
            },
          ],
        },
      },
    },
    zh: {
      label: "繁體中文",
      lang: "zh-TW",
      link: "/zh/",
      themeConfig: {
        nav: [
          { text: "指南", link: "/zh/guide/getting-started" },
          { text: "API 參考", link: "/zh/reference/api" },
        ],
        sidebar: {
          "/zh/guide/": [
            {
              text: "介紹",
              items: [
                { text: "概覽", link: "/zh/guide/overview" },
                { text: "快速開始", link: "/zh/guide/getting-started" },
                { text: "CLI 指令參考", link: "/zh/guide/cli" },
              ],
            },
            {
              text: "核心功能",
              items: [
                { text: "代理伺服器", link: "/zh/guide/proxy" },
                { text: "儀表板", link: "/zh/guide/dashboard" },
                { text: "Provider 金鑰管理", link: "/zh/guide/providers" },
                { text: "告警系統", link: "/zh/guide/alerts" },
                { text: "多 Agent 設定", link: "/zh/guide/multi-agent" },
              ],
            },
            {
              text: "治理功能",
              items: [
                { text: "Security Shield 安全護盾", link: "/zh/guide/security" },
                { text: "Kill Switch 緊急停止", link: "/zh/guide/kill-switch" },
                { text: "Model Override 模型覆蓋", link: "/zh/guide/model-override" },
                { text: "Rate Limiting 請求限制", link: "/zh/guide/rate-limiting" },
              ],
            },
            {
              text: "部署",
              items: [
                { text: "Docker", link: "/zh/guide/docker" },
              ],
            },
            {
              text: "整合指南",
              items: [
                { text: "OpenClaw", link: "/zh/guide/openclaw" },
                { text: "MCP Server", link: "/zh/guide/mcp" },
              ],
            },
            {
              text: "幫助",
              items: [{ text: "常見問題", link: "/zh/guide/faq" }],
            },
          ],
          "/zh/reference/": [
            {
              text: "參考",
              items: [{ text: "API", link: "/zh/reference/api" }],
            },
          ],
        },
      },
    },
  },
});
