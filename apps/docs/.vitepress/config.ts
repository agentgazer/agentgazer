import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AgentTrace",
  description: "AI Agent Observability",

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  ],

  themeConfig: {
    logo: {
      light: "/logo.svg",
      dark: "/logo.svg",
    },
    siteTitle: "AgentTrace",
    socialLinks: [
      { icon: "github", link: "https://github.com/agenttrace/agenttrace" },
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
                { text: "SDK", link: "/en/guide/sdk" },
                { text: "Dashboard", link: "/en/guide/dashboard" },
                { text: "Provider Keys", link: "/en/guide/providers" },
                { text: "Alerts", link: "/en/guide/alerts" },
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
                { text: "SDK", link: "/zh/guide/sdk" },
                { text: "儀表板", link: "/zh/guide/dashboard" },
                { text: "Provider 金鑰管理", link: "/zh/guide/providers" },
                { text: "告警系統", link: "/zh/guide/alerts" },
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
