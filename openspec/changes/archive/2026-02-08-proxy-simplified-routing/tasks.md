## 1. Shared Package - Add Chat Endpoint Lookup

- [x] 1.1 Add `getProviderChatEndpoint()` function to `packages/shared/src/providers.ts` that returns complete chat URL per provider
- [x] 1.2 Add unit tests for `getProviderChatEndpoint()` in `packages/shared/src/__tests__/providers.test.ts`

## 2. Proxy - Add Simplified Route Handler

- [x] 2.1 Add new route handler for `POST /agents/:agent/:provider` (no trailing path) in `packages/proxy/src/proxy-server.ts`
- [x] 2.2 Implement route logic: lookup chat endpoint, get API key, forward request, parse response
- [x] 2.3 Return 400 for unknown provider with helpful error message

## 3. Documentation

- [x] 3.1 Update proxy documentation to recommend simplified routing pattern
- [x] 3.2 Add OpenClaw integration example using simplified route
