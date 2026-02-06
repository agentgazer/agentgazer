## Context

AgentGazer 目前是純觀察者角色，記錄 agent 的 LLM 呼叫但不介入。用戶反饋需要成本控制、快速測試、集中管理 model 的能力。由於一個 agent 可能同時使用多個 provider（如 OpenAI 處理簡單問答、Anthropic 處理複雜推理），需要 per-agent-per-provider 的 override 規則。

**現有架構：**
```
Agent → Proxy(:4000/provider/...) → Provider API
              ↓
         記錄 events
```

**目標架構：**
```
Agent → Proxy → 查詢 override 規則 → 改寫 model → Provider API
              ↓
         記錄 requested_model + actual model
```

## Goals / Non-Goals

**Goals:**
- Per-agent-per-provider 的 model override 規則
- Dashboard 可視化：顯示 agent 使用的 providers、設定 override、查看 request log
- Proxy 透明改寫：agent 不需要知道被 override
- Model 清單：從 shared package 提供可選 model 列表

**Non-Goals:**
- 跨 provider 路由（如 gpt-4 → claude-sonnet）：需要 API 格式轉換，複雜度高
- Model 能力檢查：不驗證 override 的 model 是否支援 agent 請求的功能（如 vision），讓 provider 回傳錯誤
- Agent 通知機制：不需要告知 agent 被 override

## Decisions

### 1. Override 規則儲存：獨立 table vs JSON 欄位

**選擇：獨立 `agent_model_rules` table**

```sql
CREATE TABLE agent_model_rules (
  id INTEGER PRIMARY KEY,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_override TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, provider)
);
```

理由：
- 查詢效能：Proxy 每次請求都要查，indexed column 比 JSON 解析快
- 清晰的資料模型：一個 agent 對多個 provider 的關係明確
- 易於擴展：未來可以加更多欄位（如 enabled、priority）

替代方案（rejected）：
- JSON 欄位在 agents table：查詢不方便，需要 JSON extract

### 2. Provider 發現：自動 vs 手動設定

**選擇：從 events 自動發現**

```sql
SELECT DISTINCT provider FROM agent_events WHERE agent_id = ?
```

理由：
- 符合「觀察者」哲學：記錄發生過什麼
- 零設定：用戶不需要預先配置 agent 使用哪些 provider
- 真實數據：顯示的是實際使用過的 provider

替代方案（rejected）：
- 手動設定：多一步，容易過時

### 3. Proxy 如何取得 override 規則

**選擇：Proxy 呼叫 Server API**

```
Proxy → GET /api/agents/{agent_id}/model-rules/{provider}
        → 返回 { model_override: "gpt-4o-mini" } 或 null
```

理由：
- 單一資料來源：DB 只在 Server 管理
- 一致性：Dashboard 和 Proxy 看到相同的規則
- 快取：Proxy 可以快取規則，設定短 TTL（如 30 秒）

替代方案（rejected）：
- Proxy 直接讀 DB：違反分層，且需要 DB connection 管理
- Proxy 內建規則：無法從 Dashboard 動態更新

### 4. Model 清單來源

**選擇：Shared package 靜態列表**

```typescript
// packages/shared/src/models.ts
export const SELECTABLE_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku'],
  // ...
};
```

理由：
- 簡單：不需要 API call
- 可控：只列出通用可用的 model，排除需要特殊申請的
- 與 pricing table 一致：已有 model 資訊

替代方案（rejected）：
- 從 provider API 動態取得：各家 API 不一致，有些不提供

## Risks / Trade-offs

**[Proxy 效能]** 每次請求都查詢 override 規則
→ 使用快取，30 秒 TTL，miss 時才查 API

**[規則過時]** 用戶刪除 agent 但規則還在
→ agent_model_rules 加 FK constraint with CASCADE DELETE

**[Model 清單過時]** 新 model 發布但清單沒更新
→ 允許用戶輸入自訂 model（下拉 + 自由輸入）

**[Override 錯誤]** 用戶選的 model 不存在或沒權限
→ Provider 會回傳錯誤，Dashboard 在 request log 顯示錯誤
