# Rate Limiting 請求限制

Rate Limiting 防止 Agent 壓垮 LLM Provider 並耗盡你的 API 配額。

## 問題

AI Agent 可能發送請求的速度超過你的 API 配額允許：

- **流量爆發** — Agent 處理積壓並一次送出大量請求
- **重試風暴** — 失敗的請求觸發重試，放大負載
- **失控迴圈** — Agent 卡在迴圈中（參見 [Kill Switch](/zh/guide/kill-switch)）
- **多 Agent 競爭** — 多個 Agent 競爭相同的配額

沒有請求限制，你會觸及 provider 的速率限制、收到錯誤，並在失敗重試上浪費錢。

## 運作原理

AgentGazer 使用**滑動視窗**演算法：

```
視窗: 60 秒
限制: 100 請求

時間軸:
[----60 秒----]
 R R R R ... R R R  = 100 請求
                 ↑
              新請求到達
              → 被拒絕 (429 Too Many Requests)
              → Retry-After: 45 秒
```

1. 記錄每個請求的時間戳
2. 新請求到達時，移除超出視窗的舊時間戳
3. 如果剩餘計數 ≥ 最大請求數，請求被拒絕
4. 回應包含 `retry_after_seconds`，根據最舊請求過期時間計算

## 設定

在 Dashboard 設定 Rate Limiting：**Agent 詳情 → Rate Limit Settings**

| 控制項 | 說明 |
|--------|------|
| **Provider 下拉選單** | 選擇要加入限制的 provider |
| **Max Requests** | 視窗內的最大請求數 |
| **Window (seconds)** | 滑動視窗長度 |
| **Add / Remove** | 管理限制設定 |

### 範例

「每 60 秒 100 個請求」表示：

- Agent 最多可對該 provider 發送 100 個請求
- 在任何 60 秒的滑動視窗內
- 第 101 個請求會被拒絕，直到較舊的請求落出視窗外

## 回應格式

被限制時，Proxy 返回 `429 Too Many Requests`：

**OpenAI 格式：**

```json
{
  "error": {
    "message": "Rate limit exceeded for agent \"my-bot\" on openai. Please retry after 45 seconds.",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  },
  "retry_after_seconds": 45
}
```

**Anthropic 格式：**

```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit exceeded for agent \"my-bot\" on anthropic. Please retry after 45 seconds."
  },
  "retry_after_seconds": 45
}
```

也會設定 `Retry-After` HTTP header。

## 範圍

請求限制是 **per-agent per-provider**：

- Agent "code-bot" 可以對 OpenAI 設 100 req/min
- Agent "code-bot" 可以對 Anthropic 設 50 req/min
- Agent "chat-bot" 有自己獨立的限制

這讓你可以根據優先級在 Agent 間分配配額。

## Provider 級別限制

除了 per-agent 限制，你也可以設定 **provider 級別**的限制：

**Dashboard → Providers → Provider 詳情 → Rate Limit**

這會設定跨所有 Agent 的全域限制。適用於：

- 保持在你的整體 API 層級限制內
- 防止任何單一 provider 被壓垮
- 緊急節流

當 agent 級別和 provider 級別限制都存在時，**兩者都會執行** — 請求必須通過兩個檢查。

## 阻擋原因

被限制的請求會記錄阻擋原因 `rate_limited`：

- 在 Agent 詳情 → Blocked Events 中可見
- 可在 Request Log 中篩選
- 包含在事件匯出中

## API

請求限制也可以透過 API 管理：

```bash
# 列出 Agent 的限制
GET /api/agents/:agentId/rate-limits

# 設定限制
PUT /api/agents/:agentId/rate-limits/:provider
{
  "max_requests": 100,
  "window_seconds": 60
}

# 移除限制
DELETE /api/agents/:agentId/rate-limits/:provider
```

## 最佳實踐

### 設定適當的限制

| 層級 | 建議限制 | 使用情境 |
|------|----------|----------|
| 保守 | 10 req/min | 開發、測試 |
| 適中 | 60 req/min | 生產批次作業 |
| 積極 | 300 req/min | 高吞吐量 Agent |

### 監控

在 Dashboard 檢查：

- **Blocked Events 計數** — 數字高表示限制太低
- **阻擋原因分析** — `rate_limited` vs 其他原因
- **請求模式** — 識別流量爆發時間

### 與 Kill Switch 結合

Rate Limiting 和 Kill Switch 相輔相成：

- **Rate Limiting** — 防止配額耗盡
- **Kill Switch** — 停止無限迴圈

陷入迴圈的 Agent 會先觸及請求限制，減慢速度。如果迴圈持續，Kill Switch 會偵測到模式並停用 Agent。

## 與其他工具比較

| 功能 | Langsmith | Langfuse | Helicone | AgentGazer |
|------|:---------:|:--------:|:--------:|:----------:|
| Rate Limiting | ❌ | ❌ | ❌ | ✅ |
| Per-Agent 限制 | ❌ | ❌ | ❌ | ✅ |
| 滑動視窗 | ❌ | ❌ | ❌ | ✅ |
| Retry-After Header | ❌ | ❌ | ❌ | ✅ |

其他工具不會碰你的請求 — 他們只能事後報告。AgentGazer 會在請求送到 provider 之前主動執行限制。
