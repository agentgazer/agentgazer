# Model Override 模型覆蓋

Model Override 讓你用便宜的模型替換昂貴的模型 — 不需要改程式碼。

## 問題

你的 AI Agent 寫死使用 `gpt-4o`，但你想要：

- **降低成本** 換成 `gpt-4o-mini`
- **測試** Agent 在不同模型下的表現
- **快速回滾** 如果新模型出問題

通常你得修改 Agent 程式碼、重新部署，然後祈禱不要出問題。用 Model Override，你只要在 Dashboard 改一下，立即生效。

## 運作原理

```
Agent 請求: gpt-4           你的覆蓋規則: openai → gpt-4o-mini
      ↓                                    ↓
   Proxy 攔截 ──────────────────────→ 改寫為 gpt-4o-mini
      ↓
   送到 OpenAI
      ↓
   事件記錄: requested_model=gpt-4, model=gpt-4o-mini
```

1. Agent 發送包含原始模型的請求（例如 `gpt-4`）
2. Proxy 檢查此 agent + provider 的覆蓋規則
3. 如果規則存在，Proxy 改寫請求中的 `model` 欄位
4. 請求以覆蓋後的模型送到 provider
5. 事件記錄兩個模型以便稽核

## 設定

在 Dashboard 設定 Model Override：**Agent 詳情 → Model Settings**

對於 Agent 使用過的每個 provider，你會看到：

| 控制項 | 說明 |
|--------|------|
| **Model 下拉選單** | 選擇覆蓋模型或「None」 |
| **Override Active 標籤** | 顯示覆蓋是否生效 |

### 設定覆蓋

1. 前往 Agent 詳情頁
2. 捲動到 Model Settings 區塊
3. 從下拉選單選擇想要的模型
4. 覆蓋立即生效

### 移除覆蓋

1. 從下拉選單選擇「None」
2. Agent 會使用原始模型

## Request Log

當覆蓋生效時，Request Log 會顯示兩個模型：

```
gpt-4 → gpt-4o-mini   500 / 200 tokens   $0.0015
```

這讓你可以輕鬆稽核 Agent 請求的是什麼 vs 實際使用的是什麼。

## 使用情境

### 成本控制

強制 Agent 使用便宜的模型：

| 原始 | 覆蓋 | 節省 |
|------|------|------|
| gpt-4o | gpt-4o-mini | ~90% |
| claude-opus-4-5 | claude-haiku | ~95% |
| gemini-1.5-pro | gemini-1.5-flash | ~85% |

### A/B 測試

比較 Agent 在不同模型下的表現：

1. 使用原始模型執行 Agent，記錄指標
2. 套用覆蓋到便宜的模型
3. 比較成功率、延遲、成本
4. 做出資料驅動的決策

### 快速回滾

如果新模型出問題：

1. Agent 程式碼部署新模型
2. 偵測到問題（錯誤、回應品質差）
3. 在 Dashboard 套用覆蓋到舊模型
4. Agent 立即使用舊模型 — 不需改程式碼

## Per-Agent Per-Provider

覆蓋規則的範圍是 **agent + provider**：

- Agent "code-bot" 可以對 OpenAI 和 Anthropic 有不同的覆蓋
- Agent "chat-bot" 有自己獨立的覆蓋
- 改變一個 Agent 的覆蓋不會影響其他 Agent

## API

Model Override 也可以透過 API 管理：

```bash
# 列出 Agent 的規則
GET /api/agents/:agentId/model-rules

# 設定覆蓋
PUT /api/agents/:agentId/model-rules/:provider
{
  "model_override": "gpt-4o-mini"
}

# 移除覆蓋
DELETE /api/agents/:agentId/model-rules/:provider

# 取得可用模型
GET /api/models
```

## 與其他工具比較

| 功能 | Langsmith | Langfuse | Helicone | AgentGazer |
|------|:---------:|:--------:|:--------:|:----------:|
| Model Override | ❌ | ❌ | ❌ | ✅ |
| 請求改寫 | ❌ | ❌ | ❌ | ✅ |
| Per-Agent 規則 | ❌ | ❌ | ❌ | ✅ |

其他工具是唯讀的觀察者。AgentGazer 會主動修改請求來實現你的策略。
