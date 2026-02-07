## 1. Dockerfile Updates

- [x] 1.1 Add OCI standard labels to Dockerfile (source, version, title, description)
- [x] 1.2 Add ARG for version to pass from CI

## 2. GitHub Actions Workflow

- [x] 2.1 Create `.github/workflows/docker-publish.yml` workflow file
- [x] 2.2 Configure trigger on `push tags: v*`
- [x] 2.3 Add ghcr.io login step using GITHUB_TOKEN
- [x] 2.4 Add build and push step with version tagging

## 3. Standalone Docker Compose

- [x] 3.1 Create `docker-compose.example.yml` using published image

## 4. Documentation

- [x] 4.1 Update `apps/docs/en/guide/docker.md` with ghcr.io installation
- [x] 4.2 Update `apps/docs/zh/guide/docker.md` with ghcr.io installation
