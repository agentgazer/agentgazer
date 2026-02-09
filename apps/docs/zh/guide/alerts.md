# 告警系統

## 告警規則類型

| 類型 | 說明 | 可設定參數 | 預設值 |
|------|------|-----------|--------|
| **agent_down** | Agent 長時間未發送心跳 | `duration_minutes`：視為離線的分鐘數 | 10 分鐘 |
| **error_rate** | 錯誤率超過閾值 | `threshold`：百分比；`window_minutes`：滾動視窗 | 20%、5 分鐘 |
| **budget** | 每日花費超過預算 | `threshold`：金額上限 USD | — |
| **kill_switch** | Agent 被 Kill Switch 自動停用 | — （自動觸發） | — |

::: tip Kill Switch 告警
當 Agent 因偵測到無限迴圈而被停用時，Kill Switch 告警會自動產生。與其他告警類型不同，你不需要設定「kill_switch」告警規則 — 只要在 Agent 上啟用 Kill Switch 並設定通知管道（webhook/email），就會收到停用告警。

詳見 [Kill Switch](/zh/guide/kill-switch) 了解迴圈偵測設定。
:::

## 通知管道

每條告警規則可設定以下通知方式：

**Webhook**

- 以 POST 方式發送 JSON 到指定 URL
- 失敗時自動重試 3 次，使用指數退避（1 秒 → 4 秒 → 16 秒）

**Email（SMTP）**

- 透過 SMTP 伺服器發送告警通知
- 需設定 SMTP 相關環境變數（詳見[部署](./docker.md)章節）

**Telegram**

- 透過 Telegram Bot API 發送告警通知
- 需設定 `bot_token` 與 `chat_id`
- 可在每條規則設定或在 Settings 頁面設定預設值

## 冷卻機制

每條規則觸發後，會進入 **15 分鐘**的冷卻期，期間不會重複觸發同一條規則，避免告警疲勞。

## 重複告警

啟用重複告警可在問題持續時收到持續通知：

| 設定 | 說明 |
|------|------|
| **repeat_enabled** | 設為 `true` 時，在條件持續滿足期間會按指定間隔重複發送告警 |
| **repeat_interval_minutes** | 重複發送告警的間隔（預設：60 分鐘） |

## 恢復通知

啟用恢復通知可在問題解決時收到通知：

| 設定 | 說明 |
|------|------|
| **recovery_notify** | 設為 `true` 時，當告警條件清除時會發送通知 |

告警狀態機追蹤：`normal` → `alerting` → `normal`。從 `alerting` 轉回 `normal` 時發送恢復通知。

## 預算週期

對於預算告警，可設定預算週期：

| 週期 | 說明 |
|------|------|
| **daily** | 每天 UTC 午夜重置預算（預設） |
| **weekly** | 每週一 UTC 午夜重置預算 |
| **monthly** | 每月 1 日 UTC 午夜重置預算 |

## 管理方式

告警規則可透過兩種方式管理：

1. **儀表板 UI**：在 Alerts 頁面建立、編輯、啟用/停用、刪除規則，並查看告警歷史
2. **REST API**：透過 `/api/alerts` 端點程式化管理（詳見 [API 參考](../reference/api.md)章節）

## 建立告警規則（儀表板）

1. 前往 Alerts 頁面
2. 點擊 "New Alert Rule"
3. 選擇目標 Agent
4. 選擇規則類型（agent_down / error_rate / budget）
5. 設定相關參數
6. 填入 Webhook URL 和/或 Email 地址
7. 儲存規則

## 告警歷史

切換到 "History" 分頁，可以看到所有已觸發的告警記錄，包括觸發時間、目標 Agent、規則類型、告警訊息及發送方式。
