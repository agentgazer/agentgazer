## 1. Non-root User

- [x] 1.1 Add `RUN addgroup --system agentgazer && adduser --system --ingroup agentgazer agentgazer`
- [x] 1.2 Add `USER agentgazer` directive before CMD
- [x] 1.3 Update data directory from `/root/.agentgazer` to `/home/agentgazer/.agentgazer`
- [x] 1.4 Update `docker-compose.yml` volume mount path
- [x] 1.5 Update `docker-compose.example.yml` accordingly

## 2. Fix License Label

- [x] 2.1 Change `org.opencontainers.image.licenses` from `MIT` to `AGPL-3.0`

## 3. Include MCP Package

- [x] 3.1 Add `COPY --from=builder /app/packages/mcp/dist ./packages/mcp/dist` to production stage
- [x] 3.2 Add `COPY --from=builder /app/packages/mcp/package.json ./packages/mcp/` to production stage
- [ ] 3.3 Verify MCP binary is accessible in the container

## 4. Add HEALTHCHECK

- [x] 4.1 Add `HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:18880/api/health || exit 1`
- [x] 4.2 Ensure `curl` is available in the slim image (or use wget/node alternative)

## 5. Verification

- [ ] 5.1 Build Docker image and verify it starts correctly
- [ ] 5.2 Verify container runs as non-root (`whoami` inside container)
- [ ] 5.3 Verify HEALTHCHECK reports healthy
- [ ] 5.4 Verify MCP server is accessible inside container
