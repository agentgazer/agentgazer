# 儀表板

## 登入

儀表板使用 **Token 認證**。啟動服務後，在登入頁面輸入你的認證 Token 即可。Token 來源：

- 首次執行 `agenttrace onboard` 時產生
- 儲存在 `~/.agenttrace/config.json` 中
- 可透過 `agenttrace reset-token` 重新產生

## 頁面總覽

| 頁面 | 說明 |
|------|------|
| **Overview**（總覽） | 跨所有 Agent 的關鍵指標總覽 |
| **Agents**（Agent 列表） | 所有 Agent 的列表，含 Provider、政策狀態、活動紀錄 |
| **Agent Detail**（Agent 詳情） | 詳細統計、圖表、模型設定、政策控制 |
| **Costs**（成本） | 按 Provider / Model 的成本分析與圖表 |
| **Alerts**（告警） | 告警規則管理與告警歷史 |

## Agent 列表

Agent 列表頁面顯示所有已註冊的 Agent，包含以下欄位：

| 欄位 | 說明 |
|------|------|
| **Agent ID** | 唯一識別碼 |
| **Providers** | 使用過的 LLM Provider（如 OpenAI、Anthropic），含 override 標記 |
| **Requests** | 總請求數 |
| **Cost** | 總花費（USD） |
| **Last Activity** | 距離上次事件的時間 |
| **Status** | 政策狀態標籤 |

**狀態標籤：**

- **Inactive** — Agent 已停用（active=false）
- **Budget %** — 當日花費佔預算上限的百分比

**Override 標記：**

設有 model override 的 Provider 會顯示視覺標記（如「OpenAI*」），表示該 Provider 的請求正在被重定向到不同的模型。

## Agent 詳情頁

Agent 詳情頁提供以下資訊：

### 統計卡片

| 指標 | 說明 |
|------|------|
| Total Requests | 總請求數 |
| Total Errors | 錯誤數 |
| Blocked Requests | 被政策阻擋的請求數 |
| Error Rate | 錯誤率百分比 |
| Total Cost | 總花費（USD） |
| Tokens Used | 總 Token 用量 |
| P50 Latency | 中位數延遲（毫秒） |
| P99 Latency | 第 99 百分位延遲（毫秒） |

### 圖表

使用 Recharts 繪製：

- Token 用量趨勢圖（Input / Output token 隨時間變化）
- 成本分類圖（按 Provider / Model 分類）

### 時間範圍篩選

支援以下預設範圍：

- 1 小時（1h）
- 24 小時（24h）
- 7 天（7d）
- 30 天（30d）

### 政策設定（Policy Settings）

控制 Agent 行為的設定：

| 設定 | 說明 |
|------|------|
| **Active** | 啟用/停用 Agent。停用的 Agent 所有請求都會被阻擋。 |
| **Budget Limit** | 每日花費上限（USD）。達到上限後請求會被阻擋。 |
| **Allowed Hours** | 允許請求的時間區間（伺服器本地時間）。 |

**每日花費顯示：**

設定預算上限後，UI 會顯示當前花費 vs 上限（如「$12.34 / $20.00」）。當花費超過上限的 80% 時會出現警告標記。

**時區：**

Allowed Hours 使用伺服器本地時間。UI 會顯示伺服器時區（如「Server time: UTC+8」）。

### 模型設定（Model Settings）

覆寫每個 Provider 使用的模型。Agent 原本請求的模型會被替換成選定的模型後再轉發給 Provider。

| 控制項 | 說明 |
|--------|------|
| **Provider Card** | Agent 使用過的每個 Provider 各一張卡片 |
| **Model Dropdown** | 選擇 override 模型，或選「None」使用 Agent 預設 |
| **Override Active** | 標示 override 生效中的標籤 |

這功能適用於：
- **成本控制** — 強制 Agent 使用較便宜的模型（如 gpt-4o-mini 取代 gpt-4o）
- **測試** — 比較不同模型的行為差異
- **集中管理** — 從單一介面控制所有 Agent 的模型使用

### 頻率限制設定（Rate Limit Settings）

設定每個 Provider 的請求頻率限制。當超過限制時，Proxy 會回傳 `429 Too Many Requests` 回應。

| 控制項 | 說明 |
|--------|------|
| **Provider Dropdown** | 選擇要新增頻率限制的 Provider |
| **Max Requests** | 時間窗口內允許的最大請求數 |
| **Window (seconds)** | 頻率限制的時間窗口（滑動窗口） |
| **Add / Apply / Remove** | 管理頻率限制設定 |

**運作方式：**

- 頻率限制是 per-agent per-provider（如 agent「my-bot」可以對 OpenAI 和 Anthropic 設定不同限制）
- 使用滑動窗口演算法 — 計算過去 N 秒內的請求數
- 超過限制時，回應會包含 `retry_after_seconds` 指示何時可以重試
- 被限制的請求會記錄阻擋原因 `rate_limited`

**範例：**

設定「每 60 秒 100 個請求」表示該 Agent 在任意 60 秒滑動窗口內，最多可對該 Provider 發送 100 個請求。

詳見 [Proxy 頻率限制](/zh/guide/proxy#頻率限制-rate-limiting) 了解回應格式。

### 請求日誌（Request Log）

近期 LLM 呼叫紀錄，包含以下欄位：

| 欄位 | 說明 |
|------|------|
| **Timestamp** | 請求時間 |
| **Provider** | LLM Provider |
| **Model** | 請求的模型與實際使用的模型（若不同則顯示如「gpt-4 → gpt-4o-mini」） |
| **Tokens** | Input / Output token 數量 |
| **Cost** | 請求成本（USD） |

### 阻擋事件（Blocked Events）

當請求被政策阻擋時，儀表板會顯示：

- **Blocked Count** — 被阻擋的總請求數
- **Block Reasons** — 按原因分類：
  - `agent_deactivated` — Agent 已停用
  - `budget_exceeded` — 已達每日預算上限
  - `outside_allowed_hours` — 請求時間在允許區間外

## 成本分析

成本頁面提供跨 Provider 與 Model 的花費彙總：

- 成本趨勢圖
- 按 Provider 的成本分類
- 按 Model 的成本分類
