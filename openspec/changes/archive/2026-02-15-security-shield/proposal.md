# Proposal: Security Shield

## Why

MCP tools and third-party integrations can contain malicious code that may:
- Inject malicious prompts to hijack LLM behavior
- Leak sensitive data (API keys, credit cards, crypto wallets)
- Abuse tool calls to perform unauthorized actions

AgentGazer sits at the proxy layer and can detect/block these threats before they reach the LLM or return to the agent.

## What Changes

Add a Security Shield feature with three main protection modules:

1. **Prompt Injection Detection** - Detect malicious instructions in tool outputs
2. **Sensitive Data Masking** - Redact API keys, credit cards, personal data, crypto keys
3. **Tool Call Restrictions** - Limit tool call frequency and block dangerous tools

All features are toggleable at both category and individual rule level. Configuration can be applied globally (ALL agents) or per-agent.

## Scope

- Proxy layer only (no MCP server hooks)
- Rule-based detection (no LLM-based detection)
- Dashboard Security page for configuration
- Security events logged and viewable

## Out of Scope

- HTML/Script tag stripping (causes false positives with code)
- Real-time LLM-based threat detection
- MCP server sandboxing
