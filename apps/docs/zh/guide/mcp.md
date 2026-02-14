# MCP 整合

AgentGazer 提供 MCP (Model Context Protocol) 伺服器，讓 AI Agent 能夠查詢自己的成本和使用量數據。這創建了「成本感知 Agent」，能夠監控自己的花費並做出明智的決策。

## 概述

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   AI Agent (OpenClaw, Claude Code 等)                       │
│        │                                                    │
│        │ stdio                                              │
│        ▼                                                    │
│   ┌──────────────────┐         ┌──────────────────┐         │
│   │  agentgazer-mcp  │──HTTP──▶│ AgentGazer Server│         │
│   └──────────────────┘         │    :18880        │         │
│                                └──────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 安裝

### 本機

如果已安裝 AgentGazer CLI，MCP 已經可用：

```bash
agentgazer-mcp --help
```

### 遠端機器

對於連接到中央 AgentGazer 伺服器的遠端 Agent：

```bash
npm install -g @agentgazer/mcp
agentgazer-mcp init
```

## 設定

### 透過 OpenClaw Dashboard

最簡單的設定方式是透過 AgentGazer Dashboard：

1. 開啟 AgentGazer Dashboard
2. 前往「OpenClaw 整合」頁面
3. 點擊「套用設定」

這會自動設定 Provider 路由和 MCP 伺服器。

### 手動設定

新增至 OpenClaw 設定檔 (`~/.openclaw/openclaw.json`)：

```json
{
  "mcpServers": {
    "agentgazer": {
      "command": "agentgazer-mcp",
      "env": {
        "AGENTGAZER_ENDPOINT": "http://localhost:18880",
        "AGENTGAZER_TOKEN": "your-token-here",
        "AGENTGAZER_AGENT_ID": "my-agent"
      }
    }
  }
}
```

### 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `AGENTGAZER_ENDPOINT` | AgentGazer 伺服器 URL | `http://localhost:18880` |
| `AGENTGAZER_TOKEN` | API 認證 Token | 必填 |
| `AGENTGAZER_AGENT_ID` | 唯一 Agent 識別碼 | 必填 |

## 可用工具

### get_token_usage

查詢當前 Agent 的 Token 消耗量。

**參數：**
- `period` (選填)：時間過濾器 (`today`, `7d`, `30d`)
- `model` (選填)：依模型過濾

**範例回應：**
```
Token Usage:
  Input tokens:  15,234
  Output tokens: 8,921
  Total tokens:  24,155
```

### get_cost

查詢花費（美元）。

**參數：**
- `period` (選填)：時間過濾器
- `breakdown` (選填)：包含各模型明細

**範例回應：**
```
Cost: $2.4500 USD

Breakdown by model:
  claude-opus-4-5-20251101: $1.8200
  gpt-4o: $0.6300
```

### get_budget_status

檢查預算限制和剩餘額度。

**範例回應：**
```
Budget Status:
  Limit:     $50.00
  Used:      $12.45
  Remaining: $37.55
  Progress:  24.9%
```

### estimate_cost

在執行前預測操作成本。

**參數：**
- `model`：模型名稱（必填）
- `input_tokens`：預估輸入 Token 數（必填）
- `output_tokens`：預估輸出 Token 數（必填）

**範例回應：**
```
Cost Estimate:
  Model:         claude-opus-4-5-20251101
  Input tokens:  10,000
  Output tokens: 5,000
  Estimated:     $0.3500 USD
```

### whoami

取得當前 Agent 身份和連線狀態。

**範例回應：**
```
Agent Identity:
  Agent ID:  my-coding-agent
  Endpoint:  http://localhost:18880
  Connected: Yes
  Server:    AgentGazer 0.5.5
```

## 使用情境

### 預算感知回應

Agent 可以在執行昂貴操作前檢查剩餘預算：

```
「今天我已經花了 $45，預算是 $50。
讓我在停止前總結一下目前的進度。」
```

### 成本報告

Agent 可以在會話結束時報告花費：

```
「任務完成。這次會話花費 $2.35，
使用了 45,000 tokens。」
```

### 資源預估

在大型操作前，Agent 可以預估成本：

```
「這個分析大約需要 100K tokens。
預估成本：$3.50。要繼續嗎？」
```

## 遠端設定

對於多機器部署，Agent 運行在不同機器上：

1. 在每台 Agent 機器上安裝 MCP 套件：
   ```bash
   npm install -g @agentgazer/mcp
   ```

2. 設定中央伺服器端點：
   ```bash
   agentgazer-mcp init \
     --endpoint http://192.168.1.100:18880 \
     --token ag_xxx \
     --agent-id dev-machine-1
   ```

3. 在每台機器上新增至 OpenClaw 設定

## 疑難排解

### 「無法連接到 AgentGazer」

確保 AgentGazer 伺服器正在運行：
```bash
agentgazer status
```

### 「缺少 Token」

從以下位置取得 Token：
```bash
agentgazer status
# 或檢查 ~/.agentgazer/config.json
```

### MCP 未顯示在 Agent 中

1. 確認設定檔存在：`~/.openclaw/openclaw.json`
2. 檢查 MCP 伺服器設定是否存在
3. 重新啟動 AI Agent 應用程式
