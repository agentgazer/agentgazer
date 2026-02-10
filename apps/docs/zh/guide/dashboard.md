# 儀表板

## 登入

儀表板使用 **Token 認證**。啟動服務後，在登入頁面輸入你的認證 Token 即可。Token 來源：

- 首次執行 `agentgazer onboard` 時產生
- 儲存在 `~/.agentgazer/config.json` 中
- 可透過 `agentgazer reset-token` 重新產生

## 頁面總覽

| 頁面 | 說明 |
|------|------|
| **Overview**（總覽） | 跨所有 Agent 的關鍵指標總覽 |
| **Agents**（Agent 列表） | 所有 Agent 的列表，含 Provider、政策狀態、活動紀錄 |
| **Agent Detail**（Agent 詳情） | 詳細統計、圖表、模型設定、政策控制 |
| **Costs**（成本） | 按 Provider / Model 的成本分析與圖表 |
| **Alerts**（告警） | 告警規則管理與告警歷史 |
| **Providers**（Provider） | Provider 設定、API Key 管理與使用統計 |
| **OpenClaw** | 一鍵整合 OpenClaw 個人 AI 助手 |
| **Settings**（設定） | 伺服器設定、預設通知管道（Telegram、Email、Webhook） |

## Providers（Provider 管理）

Providers 頁面讓你管理 LLM Provider 的連線與設定。

### Provider 列表

Provider 頁面顯示包含以下欄位的表格：

| 欄位 | 說明 |
|------|------|
| **Provider** | Provider 名稱與圖示（點擊可查看詳情） |
| **Status** | 啟用/停用的切換開關 |
| **Agents** | 使用此 Provider 的 Agent 數量 |
| **Total Tokens** | 跨所有 Agent 的總 Token 消耗 |
| **Total Cost** | 總花費（USD） |
| **Today Cost** | 當日花費（USD） |

Provider 按總成本排序（最高的在前）。點擊 Provider 列可進入詳情頁。

### 新增 Provider

::: warning 安全提醒
「Add Provider」按鈕只有在透過 localhost（127.0.0.1 或 ::1）連線時才會啟用。當透過 LAN 位址連線時，按鈕會被停用以保護 API Key 在傳輸過程中的安全。
:::

新增 Provider 的步驟：

1. 點擊「Add Provider」（僅限 localhost）
2. 從下拉選單選擇 Provider
3. 輸入 API Key
4. 點擊「Test & Save」

系統會在儲存前驗證 API Key。若驗證失敗，Provider 仍會被儲存並顯示警告 — 你可以稍後從 Provider 詳情頁再次測試連線。

### Provider 詳情頁

#### 設定區塊

| 設定 | 說明 |
|------|------|
| **Active** | 啟用/停用 Provider。停用的 Provider 會阻擋所有請求。 |
| **Rate Limit** | 啟用並設定此 Provider 的全域頻率限制 |
| **Max Requests** | 時間窗口內允許的最大請求數 |
| **Window (seconds)** | 滑動窗口時間長度 |

當 Provider 被停用時，所有使用該 Provider 的 Agent 會收到 `403 Forbidden` 回應，原因為 `provider_deactivated`。

當超過頻率限制時，Agent 會收到 `429 Too Many Requests` 回應，原因為 `provider_rate_limited`。

#### 模型區塊

檢視並管理 Provider 的模型：

- **內建模型** — 來自定價表的預設模型（唯讀）
- **自訂模型** — 使用者新增的模型（可刪除）
- **Verified 標籤** — 模型已測試確認存在

新增自訂模型：

1. 輸入模型 ID（如 `gpt-4o-2024-11-20`）
2. 點擊「Test & Add」
3. 若模型存在，會被加入列表

#### 統計區塊

Provider 的使用統計，支援時間範圍篩選（1h、24h、7d、30d）：

| 指標 | 說明 |
|------|------|
| **Total Requests** | 對此 Provider 的請求數 |
| **Total Tokens** | 消耗的總 Token 數 |
| **Total Cost** | 總花費（USD） |

圓餅圖顯示按模型分類的成本。

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

### Kill Switch 設定

設定自動迴圈偵測，防止失控的 Agent 燒錢。

| 控制項 | 說明 |
|--------|------|
| **Enable Toggle** | 為此 Agent 開啟/關閉 Kill Switch |
| **Window Size** | 分析的最近請求數量（預設：20） |
| **Threshold** | 停用的分數閾值（預設：10.0） |

**運作方式：**

Kill Switch 使用 SimHash 偵測 Agent 行為中的重複模式：

1. 每個請求的 prompt 被正規化（數字 → `<NUM>`、時間戳 → `<TS>`、UUID → `<ID>`）
2. SimHash 計算 64 位元的位置敏感雜湊
3. 相似的 prompt Hamming distance < 3
4. 計算分數：`similar_prompts × 1.0 + similar_responses × 2.0 + repeated_tool_calls × 1.5`
5. 當分數超過閾值，Agent 自動停用

**停用標記：**

當 Agent 被 Kill Switch 停用時：
- 狀態顯示「被 Kill Switch 停用」標籤
- 可透過 Active 開關手動重新啟動
- 重新啟動時迴圈偵測視窗會自動清除

::: warning 設定通知
啟用 Kill Switch 時，也要在 Alerts 頁面設定告警通知（webhook/email），才能在 Agent 被停用時收到通知。
:::

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

::: warning 成本估算聲明
成本估算為近似值，可能與實際帳單有所差異，特別是使用快取 token 的請求。請以供應商官方控制台的帳單資訊為準。
:::

## 設定（Settings）

設定頁面讓你設定伺服器選項與預設通知管道。

### 伺服器設定

| 設定 | 說明 |
|------|------|
| **Port** | 儀表板/伺服器連接埠（預設：18800） |
| **Proxy Port** | LLM Proxy 連接埠（預設：18900） |
| **Auto Open** | 啟動時自動開啟瀏覽器 |
| **Retention Days** | 資料保留天數 |

### 預設通知管道

設定告警通知的預設值。建立新的告警規則時，這些預設值會自動填入。

**Telegram**

| 設定 | 說明 |
|------|------|
| **Bot Token** | Telegram bot API token（從 @BotFather 取得） |
| **Chat ID** | 通知目標的聊天室/群組 ID |

**Email（SMTP）**

| 設定 | 說明 |
|------|------|
| **Host** | SMTP 伺服器主機名稱 |
| **Port** | SMTP 連接埠（預設：587） |
| **TLS** | 啟用 TLS 加密 |
| **User** | SMTP 使用者名稱 |
| **Password** | SMTP 密碼 |
| **From** | 寄件者電子郵件地址 |
| **To** | 預設收件者電子郵件地址 |

**Webhook**

| 設定 | 說明 |
|------|------|
| **URL** | 預設 webhook 端點 URL |
