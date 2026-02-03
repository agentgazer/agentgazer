# ---- Build stage ----
FROM node:20-slim AS build

WORKDIR /app

# Copy root package manifests and lockfile first for layer caching
COPY package.json package-lock.json turbo.json ./

# Copy all workspace package.json files so npm ci can resolve the workspace tree
COPY packages/cli/package.json       packages/cli/package.json
COPY packages/server/package.json    packages/server/package.json
COPY packages/proxy/package.json     packages/proxy/package.json
COPY packages/shared/package.json    packages/shared/package.json
COPY packages/sdk/package.json       packages/sdk/package.json
COPY apps/dashboard/package.json     apps/dashboard/package.json
COPY apps/dashboard-local/package.json apps/dashboard-local/package.json

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy the full source tree
COPY . .

# Build every workspace package via Turborepo
RUN npx turbo build

# ---- Production stage ----
FROM node:20-slim AS production

WORKDIR /app

# Copy root package manifests and lockfile
COPY package.json package-lock.json turbo.json ./

# Copy workspace package.json files (needed for npm to resolve workspaces)
COPY packages/cli/package.json       packages/cli/package.json
COPY packages/server/package.json    packages/server/package.json
COPY packages/proxy/package.json     packages/proxy/package.json
COPY packages/shared/package.json    packages/shared/package.json
COPY packages/sdk/package.json       packages/sdk/package.json
COPY apps/dashboard/package.json     apps/dashboard/package.json
COPY apps/dashboard-local/package.json apps/dashboard-local/package.json

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built dist output from the build stage
COPY --from=build /app/packages/cli/dist       packages/cli/dist
COPY --from=build /app/packages/server/dist    packages/server/dist
COPY --from=build /app/packages/proxy/dist     packages/proxy/dist
COPY --from=build /app/packages/shared/dist    packages/shared/dist
COPY --from=build /app/packages/sdk/dist       packages/sdk/dist
COPY --from=build /app/apps/dashboard/dist     apps/dashboard/dist
COPY --from=build /app/apps/dashboard-local/dist apps/dashboard-local/dist

# Dashboard port and LLM proxy port
EXPOSE 8080
EXPOSE 4000

CMD ["node", "packages/cli/dist/cli.js", "--no-open"]
