# ---- Build stage ----
FROM node:20-slim AS build

# Build arguments for OCI labels
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF

WORKDIR /app

# Copy root package manifests and lockfile first for layer caching
COPY package.json package-lock.json turbo.json ./

# Copy all workspace package.json files so npm ci can resolve the workspace tree
COPY packages/cli/package.json       packages/cli/package.json
COPY packages/server/package.json    packages/server/package.json
COPY packages/proxy/package.json     packages/proxy/package.json
COPY packages/shared/package.json    packages/shared/package.json
COPY packages/mcp/package.json       packages/mcp/package.json
COPY apps/dashboard-local/package.json apps/dashboard-local/package.json

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy the full source tree
COPY . .

# Build every workspace package via Turborepo (exclude docs)
RUN npx turbo build --filter='!docs'

# ---- Production stage ----
FROM node:20-slim AS production

# OCI standard labels
LABEL org.opencontainers.image.title="AgentGazer"
LABEL org.opencontainers.image.description="From Observability to Control - The Missing Layer for AI Agents"
LABEL org.opencontainers.image.source="https://github.com/agentgazer/agentgazer"
LABEL org.opencontainers.image.url="https://agentgazer.com"
LABEL org.opencontainers.image.vendor="AgentGazer"
LABEL org.opencontainers.image.licenses="AGPL-3.0"

# Dynamic labels from build args
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"

WORKDIR /app

# Copy root package manifests and lockfile
COPY package.json package-lock.json turbo.json ./

# Copy workspace package.json files (needed for npm to resolve workspaces)
COPY packages/cli/package.json       packages/cli/package.json
COPY packages/server/package.json    packages/server/package.json
COPY packages/proxy/package.json     packages/proxy/package.json
COPY packages/shared/package.json    packages/shared/package.json
COPY packages/mcp/package.json       packages/mcp/package.json
COPY apps/dashboard-local/package.json apps/dashboard-local/package.json

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built dist output from the build stage
COPY --from=build /app/packages/cli/dist       packages/cli/dist
COPY --from=build /app/packages/server/dist    packages/server/dist
COPY --from=build /app/packages/proxy/dist     packages/proxy/dist
COPY --from=build /app/packages/shared/dist    packages/shared/dist
COPY --from=build /app/packages/mcp/dist         packages/mcp/dist
COPY --from=build /app/apps/dashboard-local/dist apps/dashboard-local/dist

# Create non-root user
RUN addgroup --system agentgazer && adduser --system --ingroup agentgazer agentgazer
RUN mkdir -p /home/agentgazer/.agentgazer && chown -R agentgazer:agentgazer /home/agentgazer/.agentgazer

# Dashboard/server port and LLM proxy port
EXPOSE 18880
EXPOSE 18900

# Health check using node (curl may not be available in slim image)
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:18880/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# Run as non-root user
USER agentgazer

CMD ["node", "packages/cli/dist/cli.js", "start", "--no-open"]
