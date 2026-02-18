# CLI 指令參考

## 指令總覽

### 核心指令

| 指令 | 說明 | 旗標 |
|------|------|------|
| `onboard` | 首次設定，產生 Token，設定 Provider | — |
| `start` | 啟動伺服器、Proxy、儀表板 | `--port`、`--proxy-port`、`--retention-days`、`--no-open`、`-v` |
| `stop` | 停止所有執行中的服務 | — |
| `status` | 顯示目前設定資訊 | — |
| `logs` | 查看服務日誌 | `--follow`、`--lines` |
| `reset-token` | 重新產生認證 Token | — |
| `overview` | 啟動即時 TUI 儀表板 | `--port` |
| `version`、`--version`、`-V` | 顯示版本號 | — |
| `update` | 更新到最新版本（保留設定） | — |
| `doctor` | 系統健康檢查 | `--port`、`--proxy-port` |
| `uninstall` | 移除 AgentGazer（僅限 curl 安裝） | `--yes` |
| `help` | 顯示幫助訊息 | — |

### 事件指令

| 指令 | 說明 | 旗標 |
|------|------|------|
| `events` | 列出最近事件 | `--port`、`--agent`、`--limit`、`--output` |

### Agent 指令

| 指令 | 說明 | 旗標 |
|------|------|------|
| `agents` | 列出所有已註冊的 Agent | `--port` |
| `agent <name> active` | 啟用 Agent | `--port` |
| `agent <name> deactivate` | 停用 Agent | `--port` |
| `agent <name> killswitch on\|off` | 切換緊急停止開關 | `--port` |
| `agent <name> delete` | 刪除 Agent 及所有資料 | `--port`、`--yes` |
| `agent <name> stat` | 顯示 Agent 統計數據 | `--port`、`--range`、`-o` |
| `agent <name> model` | 列出模型覆蓋設定 | `--port` |
| `agent <name> model-override <model>` | 設定模型覆蓋 | `--port` |
| `agent <name> alerts` | 列出此 Agent 的所有告警 | `--port` |
| `agent <name> alert add <type>` | 新增告警規則 | 見下方 |
| `agent <name> alert delete <id>` | 刪除告警規則 | `--port`、`--yes` |
| `agent <name> alert reset <id>` | 重設告警為正常狀態 | `--port` |

### Provider 指令

| 指令 | 說明 | 旗標 |
|------|------|------|
| `providers` | 列出所有已設定的 Provider | `--port` |
| `provider add [name] [key]` | 新增 Provider（省略參數時進入互動模式） | — |
| `provider <name> active` | 啟用 Provider | `--port` |
| `provider <name> deactivate` | 停用 Provider | `--port` |
| `provider <name> test-connection` | 測試 API Key 有效性 | — |
| `provider <name> delete` | 刪除 Provider 及 API Key | `--yes` |
| `provider <name> models` | 列出可用模型 | — |
| `provider <name> stat` | 顯示 Provider 統計數據 | `--port`、`--range` |

## 詳細說明

### `agentgazer onboard`

首次設定精靈。產生認證 Token 並寫入 `~/.agentgazer/config.json`，引導使用者設定 Provider API Key。

### `agentgazer start`

啟動所有服務。

```bash
# 使用預設連接埠啟動
agentgazer start

# 自訂連接埠，不自動開啟瀏覽器
agentgazer start --port 9090 --proxy-port 5000 --no-open

# 設定資料保留天數為 7 天
agentgazer start --retention-days 7
```

| 旗標 | 預設值 | 說明 |
|------|--------|------|
| `--port` | `18880` | Express 伺服器與儀表板連接埠 |
| `--proxy-port` | `4000` | LLM Proxy 連接埠 |
| `--retention-days` | `30` | 事件資料保留天數 |
| `--no-open` | `false` | 啟動時不自動開啟瀏覽器 |

這些預設值可以在設定檔中覆寫（請參閱[設定檔](#設定檔)）。

### `agentgazer overview`

啟動類似 htop 風格的即時終端機 UI 儀表板，顯示系統狀態、Agent 和最近事件。

```bash
agentgazer overview
agentgazer overview --port 9090
```

**鍵盤快捷鍵：**
- `Q` 或 `ESC` — 退出
- `R` — 強制更新
- `A` — 切換只顯示活躍 Agent
- `?` — 顯示幫助

### Agent 管理

從命令列管理 Agent。

```bash
# 列出所有 Agent
agentgazer agents

# 啟用/停用 Agent
agentgazer agent my-bot active
agentgazer agent my-bot deactivate

# 切換緊急停止開關
agentgazer agent my-bot killswitch on
agentgazer agent my-bot killswitch off

# 顯示統計數據
agentgazer agent my-bot stat
agentgazer agent my-bot stat --range 7d

# 輸出為 JSON（用於腳本或 MCP 整合）
agentgazer agent my-bot stat -o json

# 查看模型覆蓋設定
agentgazer agent my-bot model

# 設定模型覆蓋（如有多個 Provider 會互動式選擇）
agentgazer agent my-bot model-override gpt-4o-mini

# 刪除 Agent
agentgazer agent my-bot delete
agentgazer agent my-bot delete --yes  # 跳過確認
```

### 告警管理（CLI）

從命令列管理告警規則。

```bash
# 列出 Agent 的所有告警
agentgazer agent my-bot alerts

# 新增錯誤率告警，使用 Telegram 通知
agentgazer agent my-bot alert add error-rate --threshold 10 --telegram

# 新增 Agent 離線告警，啟用重複通知
agentgazer agent my-bot alert add agent-down --timeout 5 --repeat --interval 30 --telegram

# 新增預算告警，使用 Webhook
agentgazer agent my-bot alert add budget --limit 20 --period daily --webhook https://example.com/alert

# 刪除告警
agentgazer agent my-bot alert delete abc123

# 重設告警狀態為正常
agentgazer agent my-bot alert reset abc123
```

**告警類型：**

| 類型 | 說明 | 主要選項 |
|------|------|----------|
| `agent-down` | 未收到心跳 | `--timeout <分鐘>` |
| `error-rate` | 錯誤率超過閾值 | `--threshold <百分比>`、`--window <分鐘>` |
| `budget` | 花費超過限制 | `--limit <美元>`、`--period <daily\|weekly\|monthly>` |

**通用選項：**

| 選項 | 說明 |
|------|------|
| `--repeat` | 啟用重複通知（預設） |
| `--no-repeat` | 僅通知一次 |
| `--interval <分鐘>` | 重複通知間隔 |
| `--recovery-notify` | 條件恢復時通知 |
| `--webhook <url>` | 發送到 Webhook URL |
| `--telegram` | 發送到已設定的 Telegram |

### Provider 管理

管理 LLM Provider 的 API Key。

```bash
# 列出所有已設定的 Provider
agentgazer providers

# 新增 Provider（完全互動式）
agentgazer provider add

# 指定 Provider 名稱（會提示輸入 Key）
agentgazer provider add openai

# 同時指定名稱與 Key（非互動式）
agentgazer provider add openai sk-xxxxxxxxxxxxx

# 啟用/停用 Provider
agentgazer provider openai active
agentgazer provider openai deactivate

# 測試連線
agentgazer provider openai test-connection

# 列出可用模型
agentgazer provider openai models

# 顯示統計數據
agentgazer provider openai stat
agentgazer provider openai stat --range 7d

# 刪除 Provider
agentgazer provider openai delete
agentgazer provider openai delete --yes  # 跳過確認
```

### `agentgazer doctor`

執行系統健康檢查，驗證伺服器與 Proxy 是否正常運作。

```bash
agentgazer doctor
agentgazer doctor --port 9090 --proxy-port 5000
```

### `agentgazer update`

檢查更新並升級到最新版本。自動偵測 AgentGazer 是透過 npm 或 Homebrew 安裝，並執行對應的更新指令。

```bash
agentgazer update
```

輸出範例：
```
  Current version: 0.3.2
  Checking for updates...

  New version available: 0.3.3

  Detected: npm global installation
  Updating via npm...

  ✓ Update complete!

  Your settings in ~/.agentgazer/ have been preserved.
```

更新過程中，`~/.agentgazer/` 中的設定檔、資料庫和 Provider Key 都會被保留。

## 設定檔

AgentGazer 將設定儲存在 `~/.agentgazer/config.json`。您可以在此設定持久化的預設值，而不需每次都傳遞 CLI 旗標。

### 可用設定

```json
{
  "token": "your-auth-token",
  "server": {
    "port": 18880,
    "proxyPort": 18900,
    "autoOpen": true
  },
  "data": {
    "retentionDays": 30
  },
  "alerts": {
    "defaults": {
      "telegram": {
        "botToken": "123456:ABC...",
        "chatId": "-100123456789"
      },
      "webhook": {
        "url": "https://example.com/webhook"
      },
      "email": {
        "host": "smtp.example.com",
        "port": 587,
        "secure": false,
        "user": "user@example.com",
        "pass": "password",
        "from": "alerts@example.com",
        "to": "admin@example.com"
      }
    }
  }
}
```

| 設定 | 類型 | 預設值 | 說明 |
|------|------|--------|------|
| `token` | string | (自動產生) | 認證 Token（首次執行時自動產生）|
| `server.port` | number | `18880` | 儀表板/伺服器連接埠 |
| `server.proxyPort` | number | `18900` | LLM Proxy 連接埠 |
| `server.autoOpen` | boolean | `true` | `agentgazer start` 時自動開啟瀏覽器 |
| `data.retentionDays` | number | `30` | 資料保留天數 |
| `alerts.defaults.telegram` | object | — | 新告警的預設 Telegram 設定 |
| `alerts.defaults.webhook` | object | — | 新告警的預設 Webhook 設定 |
| `alerts.defaults.email` | object | — | 新告警的預設 SMTP 設定 |

### 優先順序

CLI 旗標永遠優先於設定檔：

```bash
# 使用 config.json 中的 port（例如 9000）
agentgazer start

# 覆寫設定，使用 port 8080
agentgazer start --port 8080
```
