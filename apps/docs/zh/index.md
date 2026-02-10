---
layout: home

hero:
  name: AgentGazer
  text: 從可觀測到可控制
  tagline: AI Agent 缺失的治理層。Rate Limiting、Model Override、Kill Switch — 其他可觀測工具沒有的功能。
  image:
    src: /logo.svg
    alt: AgentGazer
  actions:
    - theme: brand
      text: 快速開始
      link: /zh/guide/getting-started
    - theme: alt
      text: API 參考
      link: /zh/reference/api

features:
  - title: 🛡️ Kill Switch 緊急停止
    details: 使用 SimHash 演算法檢測無限迴圈。自動停用失控的 Agent，避免燒錢。
  - title: 🔄 Model Override 模型覆蓋
    details: 不改程式碼強制替換模型。gpt-4 → gpt-4o-mini，立即省下 90% 成本。
  - title: ⏱️ Rate Limiting 請求限制
    details: 按 Provider 設定滑動窗口限制。防止 Agent 超過 API 配額。
  - title: 📊 本機優先監控
    details: 追蹤 LLM 呼叫、成本、Token、延遲。SQLite 儲存，不依賴雲端。資料留在你的機器上。
---
