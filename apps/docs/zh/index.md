---
layout: home

hero:
  name: AgentTrace
  text: Keep a pulse on your agents.
  tagline: 一個指令，在本機監控你的 AI Agent。追蹤 LLM 呼叫、成本、延遲與錯誤。
  image:
    src: /logo.svg
    alt: AgentTrace
  actions:
    - theme: brand
      text: 快速開始
      link: /zh/guide/getting-started
    - theme: alt
      text: API 參考
      link: /zh/reference/api

features:
  - title: 本機優先
    details: 所有服務都在你的機器上運行。SQLite 資料庫，不依賴雲端。你的 prompt 和 API Key 永遠不會離開你的環境。
  - title: 透明代理
    details: 將 LLM client 指向代理伺服器，自動追蹤所有呼叫。支援 OpenAI、Anthropic、Google、Mistral、Cohere。
  - title: 成本與 Token 追蹤
    details: 自動依模型計算成本。清楚看到每個 Agent 在各 Provider 上花了多少錢。
  - title: 告警通知
    details: 當 Agent 離線、錯誤率飆升或超出每日預算時收到通知。支援 Webhook 與 Email。
---
