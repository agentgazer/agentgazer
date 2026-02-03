import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AgentTrace",
  description: "AI Agent Observability",

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
                { text: "Getting Started", link: "/en/guide/getting-started" },
              ],
            },
            {
              text: "Core Concepts",
              items: [
                { text: "Proxy", link: "/en/guide/proxy" },
                { text: "SDK", link: "/en/guide/sdk" },
                { text: "Provider Keys", link: "/en/guide/providers" },
                { text: "Alerts", link: "/en/guide/alerts" },
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
                { text: "快速開始", link: "/zh/guide/getting-started" },
              ],
            },
            {
              text: "核心功能",
              items: [
                { text: "代理伺服器", link: "/zh/guide/proxy" },
                { text: "SDK", link: "/zh/guide/sdk" },
                { text: "Provider 金鑰管理", link: "/zh/guide/providers" },
                { text: "告警系統", link: "/zh/guide/alerts" },
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

  themeConfig: {
    socialLinks: [
      { icon: "github", link: "https://github.com/agenttrace/agenttrace" },
    ],
    search: {
      provider: "local",
    },
  },
});
