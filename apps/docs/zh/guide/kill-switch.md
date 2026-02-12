# Kill Switch 緊急停止

Kill Switch 自動偵測並停止失控的 AI Agent，避免燒錢。

## 問題

AI Agent 可能會陷入無限迴圈 — 重複發出相同的 API 請求，不斷累積成本卻沒有產出。常見原因：

- Agent 不斷重試失敗的動作
- 多步驟工作流程中的循環推理
- Tool call 總是返回相同結果
- Prompt 模板產生相同的請求

傳統的可觀測工具只能**旁觀**這一切發生。AgentGazer 可以**阻止**它。

## 運作原理

Kill Switch 使用 **SimHash** — 一種位置敏感的雜湊演算法 — 來偵測重複模式。

### 偵測訊號

| 訊號 | 權重 | 說明 |
|------|------|------|
| 相似 Prompts | ×1.0 | 正規化後 Hamming distance < 3 的 prompts |
| 相似 Responses | ×2.0 | Hamming distance < 3 的 LLM 回應 |
| 重複 Tool Calls | ×1.5 | 相同的 tool/function call 簽名 |

### 計分公式

```
Score = similar_prompts × 1.0 + similar_responses × 2.0 + repeated_tool_calls × 1.5
```

當分數超過設定的閾值，Agent 會自動停用。

### Prompt 正規化

在雜湊之前，prompts 會被正規化以偵測語義重複：

| 模式 | 替換為 | 範例 |
|------|--------|------|
| 數字 | `<NUM>` | "order #12345" → "order #`<NUM>`" |
| ISO 時間戳 | `<TS>` | "2024-01-15T10:30:00Z" → "`<TS>`" |
| UUID | `<ID>` | "550e8400-e29b-..." → "`<ID>`" |
| 空白 | 單一空格 | 多個空格合併 |

這確保只有動態值不同的請求會被識別為相似。

## 設定

在 Dashboard 設定 Kill Switch：**Agent 詳情 → Kill Switch 設定**

| 參數 | 預設值 | 說明 |
|------|--------|------|
| **啟用** | 關閉 | 開關以啟動迴圈偵測 |
| **視窗大小** | 20 | 分析的最近請求數量 |
| **閾值** | 10.0 | 停用的分數閾值 |

### 調校建議

- **較低閾值** = 更積極偵測（可能有誤判）
- **較高閾值** = 更寬容（可能漏掉一些迴圈）
- **較小視窗** = 更快偵測短迴圈
- **較大視窗** = 捕捉更長、更慢的迴圈

### 建議設定

| 情境 | 視窗 | 閾值 |
|------|------|------|
| 嚴格預算控制 | 10 | 5.0 |
| 平衡（預設） | 20 | 10.0 |
| 寬容 | 50 | 20.0 |

## Kill Switch 觸發時

1. Agent 被設為 `active = false`
2. Agent 的 `deactivated_by` 設為 `'kill_switch'`
3. 記錄 `event_type: "kill_switch"` 事件
4. Dashboard 顯示「被 Kill Switch 停用」標籤
5. 發送告警通知（如果有設定）
6. 封存證據 Payload 供分析使用

## Incidents 頁面

**Incidents** 頁面提供所有 Kill Switch 事件的詳細分析。

### Incidents 列表

點擊側邊欄的 **Incidents** 查看所有 Kill Switch 事件：

| 欄位 | 說明 |
|------|------|
| **Time** | Kill Switch 觸發時間 |
| **Agent** | 受影響的 Agent |
| **Provider** | 使用中的 LLM Provider |
| **Score** | 迴圈分數 vs 閾值（如「7.0/5」） |
| **Window** | 使用的偵測視窗大小 |
| **Signals** | 偵測訊號分解（P=Prompts、R=Responses、T=ToolCalls） |

### Incident 詳情

點擊「View Details」查看完整分析：

#### 計分細節

視覺化呈現迴圈分數的計算方式：

```
Loop Score: 7.0 / 5.0 (140%)

[████████████████████████████░░░░░░|░░░░░░░░░░░░░░]
0                              Threshold          2x
```

計分表格顯示各訊號的貢獻：

| 訊號 | 數量 | 權重 | 分數 |
|------|------|------|------|
| 相似 Prompts | 3 | ×1.0 | 3.0 |
| 相似 Responses | 2 | ×2.0 | 4.0 |
| 重複 Tool Calls | 0 | ×1.5 | 0.0 |
| **總計** | | | **7.0** |

#### 證據 Payload

可折疊的相似請求列表，這些請求觸發了 Kill Switch。每個 Payload 顯示：

- **Request body** — 發送給 LLM 的 prompt
- **Response body** — LLM 的回應
- **字元數** — 各 Payload 的大小

這些證據幫助你了解 Agent 在陷入迴圈時究竟在做什麼。

## 重新啟動

要重新啟動被停止的 Agent：

1. 前往 Agent 詳情頁
2. 將 **Active** 開關切換為開啟
3. 迴圈偵測視窗會自動清除
4. Agent 恢復正常運作

::: warning 建議手動檢視
在重新啟動之前，先調查 Agent 為何會迴圈。檢查 Request Log 中的重複模式。
:::

## 告警整合

Kill Switch 事件會自動觸發告警。要接收通知：

1. 前往 **Alerts** 頁面
2. 為該 Agent 設定 webhook URL 和/或 email
3. 當 Kill Switch 觸發時，你會收到包含以下資訊的告警：
   - Agent ID
   - 迴圈偵測分數
   - 停用時間戳

## API

Kill Switch 設定也可以透過 API 管理：

```bash
# 取得目前設定
GET /api/agents/:agentId/kill-switch

# 更新設定
PUT /api/agents/:agentId/kill-switch
{
  "enabled": true,
  "window_size": 20,
  "threshold": 10.0
}
```

## 與其他工具比較

| 功能 | Langsmith | Langfuse | Helicone | AgentGazer |
|------|:---------:|:--------:|:--------:|:----------:|
| 迴圈偵測 | ❌ | ❌ | ❌ | ✅ |
| 自動停用 | ❌ | ❌ | ❌ | ✅ |
| SimHash 相似度 | ❌ | ❌ | ❌ | ✅ |

其他工具只能提醒你異常 — 你還是得手動停止 Agent。AgentGazer 會自動停止它。
