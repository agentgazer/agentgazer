# 快速開始

## 安裝

**方式 A：一鍵安裝（推薦）**

```bash
curl -fsSL https://raw.githubusercontent.com/agenttrace/agenttrace/main/scripts/install.sh | sh
```

支援 macOS 和 Linux，自動下載 Node.js（如果需要）。

**方式 B：Homebrew（macOS / Linux）**

```bash
brew install agenttrace/tap/agenttrace
```

**方式 C：npm（需要 Node.js >= 18）**

```bash
npx agenttrace          # 直接執行
npm install -g agenttrace   # 或全域安裝
```

## 首次設定

執行設定精靈：

```bash
agenttrace onboard
```

這會建立 `~/.agenttrace/config.json`、產生認證 Token，並引導你設定 LLM Provider API Key。

## 啟動服務

```bash
agenttrace start
```

自動開啟儀表板 [http://localhost:8080](http://localhost:8080)。

| 服務 | 連接埠 |
|------|--------|
| 伺服器 + 儀表板 | 8080 |
| LLM Proxy | 4000 |

## 驗證

```bash
agenttrace doctor
```

## 解除安裝

```bash
# curl 安裝
agenttrace uninstall

# Homebrew
brew uninstall agenttrace

# npm
npm uninstall -g agenttrace
```

使用者資料（`~/.agenttrace/`）會保留，如需移除請手動刪除。

## 下一步

- [Proxy 指南](/zh/guide/proxy) — 透過 Proxy 路由 LLM 呼叫（零程式碼改動）
- [SDK 指南](/zh/guide/sdk) — 手動埋點追蹤
- [儀表板](/zh/guide/dashboard) — 使用 Web UI
- [告警](/zh/guide/alerts) — 設定下線、錯誤、預算通知
