---
layout: home

hero:
  name: AgentGazer
  text: From Observability to Control
  tagline: The missing governance layer for AI agents. Rate limiting, model override, kill switch — features that observability tools don't have.
  image:
    src: /logo.svg
    alt: AgentGazer
  actions:
    - theme: brand
      text: Get Started
      link: /en/guide/getting-started
    - theme: alt
      text: API Reference
      link: /en/reference/api

features:
  - title: 🛡️ Kill Switch
    details: Detect infinite loops with SimHash algorithm. Auto-deactivate runaway agents before they burn your budget.
  - title: 🔄 Model Override
    details: Force agents to use cheaper models without changing code. gpt-4 → gpt-4o-mini, save 90% cost instantly.
  - title: ⏱️ Rate Limiting
    details: Per-provider request limits with sliding window. Prevent agents from exceeding API quotas.
  - title: 📊 Local-First Observability
    details: Track LLM calls, costs, tokens, and latency. SQLite storage, no cloud dependency. Your data stays on your machine.
---
