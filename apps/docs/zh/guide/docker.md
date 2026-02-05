# 部署

## 使用 Docker Compose

```bash
docker compose up -d
```

## 連接埠對應

| 連接埠 | 服務 |
|--------|------|
| 8080 | 儀表板 + REST API |
| 4000 | LLM Proxy |

## 資料持久化

Docker 使用 `agenttrace-data` Volume 來持久化 `~/.agenttrace/` 目錄，確保 SQLite 資料庫、設定檔和加密金鑰庫在容器重啟後不會遺失。

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `NODE_ENV` | 設為 `production` 時使用 JSON 格式日誌 | — |
| `LOG_LEVEL` | 日誌等級：`debug` / `info` / `warn` / `error` | `info` |
| `SMTP_HOST` | SMTP 伺服器位址 | — |
| `SMTP_PORT` | SMTP 連接埠 | `587` |
| `SMTP_USER` | SMTP 使用者名稱 | — |
| `SMTP_PASS` | SMTP 密碼 | — |
| `SMTP_FROM` | 寄件者 Email 地址 | `alerts@agenttrace.dev` |
| `SMTP_SECURE` | 是否使用 TLS | `false` |
| `AGENTTRACE_SECRET_BACKEND` | 手動指定金鑰庫後端 | 自動偵測 |

### Email 告警設定範例

若要啟用 Email 告警，需設定 SMTP 環境變數：

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASS=your-app-password
export SMTP_FROM=alerts@your-domain.com
export SMTP_SECURE=false
```
