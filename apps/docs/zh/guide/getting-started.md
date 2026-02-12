# 快速開始

## 安裝

**方式 A：一鍵安裝（推薦）**

```bash
curl -fsSL https://raw.githubusercontent.com/agentgazer/agentgazer/main/scripts/install.sh | sh
```

支援 macOS 和 Linux，自動下載 Node.js（如果需要）。

**方式 B：Homebrew（macOS / Linux）**

```bash
brew install agentgazer/tap/agentgazer
```

**方式 C：npm（需要 Node.js >= 18）**

```bash
npx agentgazer          # 直接執行
npm install -g agentgazer   # 或全域安裝
```

## 首次設定

執行設定精靈：

```bash
agentgazer onboard
```

這會建立 `~/.agentgazer/config.json`、產生認證 Token，並引導你設定 LLM Provider API Key。

## 啟動服務

```bash
agentgazer start
```

自動開啟儀表板 [http://localhost:18880](http://localhost:18880)。

| 服務 | 連接埠 |
|------|--------|
| 伺服器 + 儀表板 | 18880 |
| LLM Proxy | 18900 |

### 除錯模式

啟動時加上 `-v` 可開啟詳細日誌：

```bash
agentgazer start -v
```

## 驗證

```bash
agentgazer doctor
```

## 解除安裝

```bash
# curl 安裝
agentgazer uninstall

# Homebrew
brew uninstall agentgazer

# npm
npm uninstall -g agentgazer
```

使用者資料（`~/.agentgazer/`）會保留，如需移除請手動刪除。

## 下一步

- [Proxy 指南](/zh/guide/proxy) — 透過 Proxy 路由 LLM 呼叫（零程式碼改動）
- [儀表板](/zh/guide/dashboard) — 使用 Web UI
- [告警](/zh/guide/alerts) — 設定下線、錯誤、預算通知
