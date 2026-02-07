# Docker 部署

## 快速開始

最快的方式啟動 AgentGazer：

```bash
docker pull ghcr.io/agentgazer/agentgazer
docker run -d \
  --name agentgazer \
  -p 8080:8080 \
  -p 4000:4000 \
  -v agentgazer-data:/app/data \
  ghcr.io/agentgazer/agentgazer
```

然後在瀏覽器開啟 http://localhost:8080。

## 使用 Docker Compose

使用 Docker Compose 更容易管理：

```bash
# 下載範例檔
curl -O https://raw.githubusercontent.com/agentgazer/agentgazer/main/docker-compose.example.yml

# 啟動服務
docker compose -f docker-compose.example.yml up -d
```

或自行建立 `docker-compose.yml`：

```yaml
services:
  agentgazer:
    image: ghcr.io/agentgazer/agentgazer:latest
    ports:
      - "8080:8080"  # 儀表板 + API
      - "4000:4000"  # LLM Proxy
    volumes:
      - agentgazer-data:/app/data
    restart: unless-stopped

volumes:
  agentgazer-data:
```

## 連接埠對應

| 連接埠 | 服務 |
|--------|------|
| 8080 | 儀表板 + REST API |
| 4000 | LLM Proxy |

## 資料持久化

Docker 使用 `agentgazer-data` Volume 來持久化 `~/.agentgazer/` 目錄，確保 SQLite 資料庫、設定檔和加密金鑰庫在容器重啟後不會遺失。

## Image 標籤

| 標籤 | 說明 |
|------|------|
| `latest` | 最新穩定版本 |
| `1.0.0` | 特定版本 |
| `1.0` | 該次要版本的最新修補版 |

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `NODE_ENV` | 設為 `production` 時使用 JSON 格式日誌 | — |
| `LOG_LEVEL` | 日誌等級：`debug` / `info` / `warn` / `error` | `info` |
| `SMTP_HOST` | SMTP 伺服器位址 | — |
| `SMTP_PORT` | SMTP 連接埠 | `587` |
| `SMTP_USER` | SMTP 使用者名稱 | — |
| `SMTP_PASS` | SMTP 密碼 | — |
| `SMTP_FROM` | 寄件者 Email 地址 | `alerts@agentgazer.com` |
| `SMTP_SECURE` | 是否使用 TLS | `false` |
| `AGENTGAZER_SECRET_BACKEND` | 手動指定金鑰庫後端 | 自動偵測 |

### Email 告警設定範例

若要啟用 Email 告警，設定 SMTP 環境變數：

```yaml
services:
  agentgazer:
    image: ghcr.io/agentgazer/agentgazer:latest
    ports:
      - "8080:8080"
      - "4000:4000"
    volumes:
      - agentgazer-data:/app/data
    environment:
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
      - SMTP_USER=your-email@gmail.com
      - SMTP_PASS=your-app-password
      - SMTP_FROM=alerts@your-domain.com
```

## 從原始碼建置

如果需要本地建置 image：

```bash
git clone https://github.com/agentgazer/agentgazer.git
cd agentgazer
docker compose up -d
```

這會使用 repo 中的 `Dockerfile` 從原始碼建置。
