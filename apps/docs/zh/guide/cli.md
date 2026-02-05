# CLI 指令參考

## 指令總覽

| 指令 | 說明 | 旗標 |
|------|------|------|
| `onboard` | 首次設定，產生 Token，設定 Provider | — |
| `start` | 啟動伺服器、Proxy、儀表板 | `--port`（預設 8080）、`--proxy-port`（預設 4000）、`--retention-days`（預設 30）、`--no-open` |
| `status` | 顯示目前設定資訊 | — |
| `reset-token` | 重新產生認證 Token | — |
| `providers list` | 列出已設定的 Provider | — |
| `providers set <name> <key>` | 儲存 Provider API Key | — |
| `providers remove <name>` | 移除 Provider | — |
| `version` | 顯示版本號 | — |
| `doctor` | 系統健康檢查 | `--port`、`--proxy-port` |
| `agents` | 列出已註冊的 Agent | `--port`、`--proxy-port` |
| `stats [agentId]` | 顯示 Agent 統計數據 | `--port`、`--proxy-port`、`--range`（1h/24h/7d/30d，預設 24h） |
| `help` | 顯示幫助訊息 | — |

## 詳細說明

### `agenttrace onboard`

首次設定精靈。產生認證 Token 並寫入 `~/.agenttrace/config.json`，引導使用者設定 Provider API Key。

### `agenttrace start`

啟動所有服務。

```bash
# 使用預設連接埠啟動
agenttrace start

# 自訂連接埠，不自動開啟瀏覽器
agenttrace start --port 9090 --proxy-port 5000 --no-open

# 設定資料保留天數為 7 天
agenttrace start --retention-days 7
```

| 旗標 | 預設值 | 說明 |
|------|--------|------|
| `--port` | `8080` | Express 伺服器與儀表板連接埠 |
| `--proxy-port` | `4000` | LLM Proxy 連接埠 |
| `--retention-days` | `30` | 事件資料保留天數 |
| `--no-open` | `false` | 啟動時不自動開啟瀏覽器 |

### `agenttrace status`

顯示目前的設定，包括 Token 前綴、已設定的 Provider、資料庫路徑等。

### `agenttrace reset-token`

重新產生認證 Token。舊 Token 將立即失效，需要更新所有使用舊 Token 的 SDK 設定與儀表板登入。

### `agenttrace providers`

管理 LLM Provider 的 API Key。

```bash
# 列出所有已設定的 Provider
agenttrace providers list

# 設定 OpenAI API Key（安全加密儲存）
agenttrace providers set openai sk-xxxxxxxxxxxxx

# 移除 Anthropic Provider
agenttrace providers remove anthropic
```

### `agenttrace doctor`

執行系統健康檢查，驗證伺服器與 Proxy 是否正常運作。

```bash
agenttrace doctor
agenttrace doctor --port 9090 --proxy-port 5000
```

### `agenttrace agents`

列出所有已註冊的 Agent 及其狀態。

```bash
agenttrace agents
```

### `agenttrace stats`

顯示 Agent 的統計數據。如果系統中只有一個 Agent，會自動選擇該 Agent。

```bash
# 顯示所有 Agent 的統計（預設 24 小時）
agenttrace stats

# 顯示特定 Agent 的統計，時間範圍 7 天
agenttrace stats my-agent --range 7d
```
