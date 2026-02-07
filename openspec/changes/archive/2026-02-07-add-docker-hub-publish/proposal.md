## Why

目前使用者必須 clone 整個 repo 才能用 Docker 部署 AgentGazer，這對於快速試用和生產部署都不方便。發布預建 image 到 GitHub Container Registry 可讓使用者一行指令就能啟動服務。

## What Changes

- 發布 image 到 `ghcr.io/agentgazer/agentgazer`
- 更新 Dockerfile 加入 OCI 標準 labels 和 metadata
- 新增 GitHub Actions workflow 自動在 release tag 時 build 和 push image
- 更新 docker.md 文件提供簡化的 pull-and-run 安裝說明
- 新增獨立的 docker-compose.example.yml 讓使用者不需 clone repo

## Capabilities

### New Capabilities

- `docker-hub-ci`: GitHub Actions workflow 自動化 Docker image 的 build 和 push

### Modified Capabilities

<!-- 無需修改現有 specs，這是新功能 -->

## Impact

- `.github/workflows/` — 新增 CI workflow
- `Dockerfile` — 加入 labels
- `docker-compose.example.yml` — 新增獨立範例檔
- `apps/docs/en/guide/docker.md` — 更新安裝說明
- `apps/docs/zh/guide/docker.md` — 更新安裝說明
