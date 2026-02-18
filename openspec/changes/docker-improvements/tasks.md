## 1. Non-root User

- [ ] 1.1 Add `RUN addgroup --system agentgazer && adduser --system --ingroup agentgazer agentgazer`
- [ ] 1.2 Add `USER agentgazer` directive before CMD
- [ ] 1.3 Update data directory from `/root/.agentgazer` to `/home/agentgazer/.agentgazer`
- [ ] 1.4 Update `docker-compose.yml` volume mount path
- [ ] 1.5 Update `docker-compose.example.yml` accordingly

## 2. Fix License Label

- [ ] 2.1 Change `org.opencontainers.image.licenses` from `MIT` to `AGPL-3.0`

## 3. Include MCP Package

- [ ] 3.1 Add `COPY --from=builder /app/packages/mcp/dist ./packages/mcp/dist` to production stage
- [ ] 3.2 Add `COPY --from=builder /app/packages/mcp/package.json ./packages/mcp/` to production stage
- [ ] 3.3 Verify MCP binary is accessible in the container

## 4. Add HEALTHCHECK

- [ ] 4.1 Add `HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:18880/api/health || exit 1`
- [ ] 4.2 Ensure `curl` is available in the slim image (or use wget/node alternative)

## 5. Verification

- [ ] 5.1 Build Docker image and verify it starts correctly
- [ ] 5.2 Verify container runs as non-root (`whoami` inside container)
- [ ] 5.3 Verify HEALTHCHECK reports healthy
- [ ] 5.4 Verify MCP server is accessible inside container
