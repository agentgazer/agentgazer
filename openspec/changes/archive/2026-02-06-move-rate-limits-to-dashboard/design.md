## Context

目前 rate limit 設定在 CLI onboard 時輸入，存在 `~/.agentgazer/config.json`，Proxy 啟動時讀取。這個流程有幾個問題：
1. 使用者第一次設定時不知道合理的值
2. 改設定要重啟服務
3. 無法針對不同 agent 設定不同限制

Proxy 啟動時已經有 SQLite db 連線傳入，可直接讀取 rate limits。

## Goals / Non-Goals

**Goals:**
- 將 rate limit 設定移到 Dashboard，讓使用者可視覺化管理
- 支援 per-agent per-provider 的 rate limit
- Proxy 可動態更新 rate limits（不需重啟）
- 簡化 CLI onboard 流程

**Non-Goals:**
- 自動遷移現有 config.json 中的 rate limit 設定
- Global rate limit（across all agents）
- Rate limit alerting（超過限制時通知）

## Decisions

### 1. 資料儲存：SQLite table

```sql
CREATE TABLE agent_rate_limits (
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id, provider)
)
```

**Rationale**: 與現有資料（events, agents, alerts）放在同一個 SQLite，保持架構一致。

### 2. Proxy 讀取策略：啟動時 + 定期刷新

- 啟動時從 SQLite 讀取所有 rate limits
- 每 30 秒刷新一次
- 使用現有的 `RateLimiter` class，新增 `updateConfigs()` method

**Alternatives considered:**
- 每次 request 都查 DB → 太慢
- Event-driven（Server 通知 Proxy）→ 複雜度高，目前 Proxy/Server 沒有這種通訊機制

### 3. API Design

```
GET    /api/agents/:agentId/rate-limits          # 列出該 agent 的 rate limits
PUT    /api/agents/:agentId/rate-limits/:provider # 設定/更新
DELETE /api/agents/:agentId/rate-limits/:provider # 移除
```

**Rationale**: 放在 `/api/agents/:agentId/` 下，與現有的 model-rules API 風格一致。

### 4. Dashboard UI 位置

放在 Agent Detail 頁面，與 Model Settings 並排。

## Risks / Trade-offs

- **[Risk] 30 秒更新延遲** → 可接受，使用者不太會頻繁更改 rate limit
- **[Risk] 現有 config 設定失效** → 文件說明 breaking change，使用者需手動重設
- **[Trade-off] 沒有 global rate limit** → 保持簡單，未來可擴展
