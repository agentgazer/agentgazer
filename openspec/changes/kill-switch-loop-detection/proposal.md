## Why

AI Agents can get stuck in infinite loops, repeatedly making LLM API calls with similar prompts and responses. This burns through API credits rapidly without producing useful output. Users need automatic protection to detect and stop runaway agents before significant cost is incurred.

## What Changes

- Add SimHash-based loop detection to identify repetitive request patterns
- Implement automatic "Kill Switch" that blocks requests when loops are detected
- Add per-agent Kill Switch configuration (enabled/disabled, thresholds)
- Integrate with existing Alert system for kill_switch notifications
- Add Dashboard UI for configuring Kill Switch per agent

## Capabilities

### New Capabilities

- `kill-switch`: Loop detection and automatic request blocking for runaway agents. Includes SimHash algorithm for similarity detection, scoring system for multiple signals (prompt similarity, response similarity, tool call repetition), and hard-kill action with alert notification.

### Modified Capabilities

- `alerting`: Add new alert type `kill_switch` for notifications when an agent is killed due to loop detection.

## Impact

- **packages/shared**: New `simhash.ts` module for SimHash algorithm
- **packages/proxy**: New `loop-detector.ts` module, integration in proxy-server.ts
- **packages/server**:
  - Database schema changes (agent kill_switch settings)
  - New API endpoints for kill_switch configuration
  - Alert system extension for kill_switch type
- **apps/dashboard-local**: Kill Switch toggle and configuration UI in AgentDetailPage
