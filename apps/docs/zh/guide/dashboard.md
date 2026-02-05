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
| **Agents**（Agent 列表） | 所有 Agent 的列表，含狀態指示燈（healthy / degraded / down），支援搜尋、篩選、分頁 |
| **Agent Detail**（Agent 詳情） | 單一 Agent 的詳細統計與圖表 |
| **Costs**（成本） | 按 Provider / Model 的成本分析與圖表 |
| **Alerts**（告警） | 告警規則管理與告警歷史 |

## Agent 詳情頁

Agent 詳情頁提供以下資訊：

**統計卡片（Stats Cards）**

| 指標 | 說明 |
|------|------|
| Total Requests | 總請求數 |
| Total Errors | 錯誤數 |
| Error Rate | 錯誤率百分比 |
| Total Cost | 總花費（USD） |
| Tokens Used | 總 Token 用量 |
| P50 Latency | 中位數延遲（毫秒） |
| P99 Latency | 第 99 百分位延遲（毫秒） |

**圖表**（使用 Recharts 繪製）

- Token 用量趨勢圖（Input / Output token 隨時間變化）
- 成本分類圖（按 Provider / Model 分類）

**時間範圍篩選**

支援以下預設範圍：

- 1 小時（1h）
- 24 小時（24h）
- 7 天（7d）
- 30 天（30d）

## 成本分析

成本頁面提供跨 Provider 與 Model 的花費彙總：

- 成本趨勢圖
- 按 Provider 的成本分類
- 按 Model 的成本分類
