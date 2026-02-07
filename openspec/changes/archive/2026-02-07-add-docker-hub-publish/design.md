## Context

目前 AgentGazer 的 Docker 部署需要使用者 clone 整個 repo，本地 build image。這對快速試用和生產部署都不友善。需要建立自動化 CI/CD pipeline 將 image 發布到 GitHub Container Registry。

現有檔案：
- `Dockerfile` — Multi-stage build (node:20-slim)
- `docker-compose.yml` — 開發/部署用 compose 檔

## Goals / Non-Goals

**Goals:**
- 使用者可透過 `docker pull ghcr.io/agentgazer/agentgazer` 取得預建 image
- Release tag（如 `v1.0.0`）自動觸發 build 並 push 到 ghcr.io
- 提供 `latest` tag 和版本號 tag（如 `1.0.0`）
- 文件更新為簡化的 pull-and-run 安裝說明

**Non-Goals:**
- 多架構 build（arm64/amd64）— 可未來加入
- Helm chart 或 Kubernetes manifests
- 私有 registry 支援

## Decisions

### 1. GitHub Container Registry

使用 GitHub Container Registry (ghcr.io)，image 名稱為 `ghcr.io/agentgazer/agentgazer`。

**Rationale**:
- 免費（public repo 無限制）
- 與 GitHub Actions 原生整合
- 使用 `GITHUB_TOKEN` 自動認證，不需額外設定 secrets
- 權限與 repo 同步

### 2. GitHub Actions Workflow

使用 GitHub Actions 的 `docker/build-push-action`：
- Trigger: `push tags: v*`
- Login: 使用內建的 `GITHUB_TOKEN`，無需額外 secrets
- Tags: `latest` + 版本號（去掉 v prefix）

**Rationale**: GitHub Actions 原生整合，免費額度足夠，社群標準做法。

### 3. Dockerfile Labels

加入 OCI 標準 labels：
- `org.opencontainers.image.source`
- `org.opencontainers.image.version`
- `org.opencontainers.image.created`
- `org.opencontainers.image.title`
- `org.opencontainers.image.description`

**Rationale**: 業界標準，Docker Hub 和其他工具會識別這些 metadata。

### 4. 獨立 docker-compose.example.yml

新增一個獨立的 `docker-compose.example.yml`，使用者可以直接下載使用，不需 clone repo。

```yaml
services:
  agentgazer:
    image: ghcr.io/agentgazer/agentgazer:latest
    ports:
      - "8080:8080"
      - "4000:4000"
    volumes:
      - agentgazer-data:/app/data
```

**Rationale**: 最小化使用者的安裝步驟。

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Image 過大 | 現有 multi-stage build 已優化，未來可考慮 Alpine |
| 版本同步問題 | 使用 git tag 作為 single source of truth |
| ghcr.io 較少人熟悉 | 文件清楚說明用法，實際使用體驗與 Docker Hub 相同 |
