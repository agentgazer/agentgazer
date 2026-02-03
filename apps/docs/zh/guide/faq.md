# 常見問題

## 一般

### AgentTrace 是什麼？

AgentTrace 是一個本機優先的 AI agent 可觀測性工具。追蹤 LLM API 呼叫、token 用量、成本、延遲和錯誤——全部在你的機器上運行，不依賴雲端。

### 支援哪些 LLM provider？

OpenAI、Anthropic、Google (Gemini)、Mistral 和 Cohere。代理會自動偵測 provider。

### 我的資料會被送到外面嗎？

不會。AgentTrace 完全在你的機器上運行。資料存在本機 SQLite 資料庫 `~/.agenttrace/agenttrace.db`。你的 prompt 和 API key 永遠不會離開你的環境。

## 代理

### 需要修改我的程式碼嗎？

不需要。只要將 LLM client 的 base URL 指向代理：

```bash
export OPENAI_BASE_URL=http://localhost:4000/v1
```

代理是透明的——轉送請求和回應，不做任何修改。

### 可以不在 AgentTrace 存 API key 嗎？

可以。如果你的應用程式已經在請求 header 中提供了自己的 API key，代理會使用那個 key 而不覆蓋。Provider key 注入是可選的。

### 代理掛了怎麼辦？

LLM 呼叫會失敗，因為它們是透過代理路由的。如果在正式環境，建議直接指向 provider，改用 SDK 追蹤。

### 代理會修改我的請求或回應嗎？

不會。代理原樣轉送請求和回應。它只讀取回應來擷取使用量指標（token 數、模型、狀態碼）。

## SDK

### 什麼時候該用 SDK，什麼時候該用代理？

| | 代理 | SDK |
|--|------|-----|
| 程式碼改動 | 不需要 | 需要埋點 |
| 涵蓋範圍 | 自動涵蓋所有 LLM 呼叫 | 只追蹤你埋點的部分 |
| 自訂事件 | 不支援 | 支援（心跳、錯誤、自訂） |
| 追蹤 (Tracing) | 不支援 | 支援（trace 和 span） |

用代理做零成本追蹤。用 SDK 做心跳、自訂事件或分散式追蹤。

### 可以同時用代理和 SDK 嗎？

可以。代理自動追蹤 LLM 呼叫指標。SDK 可以在此基礎上加入心跳、自訂事件和追蹤上下文。

## 資料

### 資料保留多久？

預設 30 天。用 `--retention-days` 設定：

```bash
agenttrace start --retention-days 7
```

### 可以匯出資料嗎？

可以。使用匯出 API：

```bash
# JSON 匯出
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/events/export?agent_id=my-agent&format=json" > events.json

# CSV 匯出
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/events/export?agent_id=my-agent&format=csv" > events.csv
```

### 成本是怎麼計算的？

AgentTrace 內建常見模型的價格資料。當代理或 SDK 記錄的事件包含 `provider`、`model` 和 token 數時，成本會自動計算。如果模型不在價格表中，成本會是 `null`。

## 效能

### 代理會拖慢我的 LLM 呼叫嗎？

代理帶來的額外延遲可忽略。它即時串流回應，並非同步處理指標。LLM API 的延遲（通常 500ms–5s）遠大於代理的開銷。

### SQLite 撐得住嗎？

撐得住。LLM 呼叫通常是低 QPS（每秒個位數到低百次）。SQLite 輕鬆應付。資料庫使用 WAL 模式以支援並行讀寫。
