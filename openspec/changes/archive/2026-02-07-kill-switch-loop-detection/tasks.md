# Tasks: Kill Switch Loop Detection

## 1. SimHash Algorithm (packages/shared)

- [x] 1.1 Create `src/simhash.ts` with 64-bit SimHash implementation
- [x] 1.2 Add `computeSimHash(text: string): bigint` function
- [x] 1.3 Add `hammingDistance(a: bigint, b: bigint): number` function
- [x] 1.4 Add `isSimilar(a: bigint, b: bigint, threshold?: number): boolean` helper
- [x] 1.5 Export from `src/index.ts`

## 2. Prompt Normalization (packages/shared)

- [x] 2.1 Create `src/normalize.ts` with normalization functions
- [x] 2.2 Implement `normalizePrompt(text: string): string`:
  - Replace numbers with `<NUM>`
  - Replace UUIDs with `<ID>`
  - Replace ISO timestamps with `<TS>`
  - Normalize whitespace
  - Lowercase
- [x] 2.3 Implement `extractUserMessage(messages: Message[]): string` for multi-turn
- [x] 2.4 Export from `src/index.ts`

## 3. Loop Detector (packages/proxy)

- [x] 3.1 Create `src/loop-detector.ts` with `LoopDetector` class
- [x] 3.2 Implement sliding window storage (`CircularBuffer` per agent)
- [x] 3.3 Implement `recordRequest(agentId, promptHash, toolCalls)` method
- [x] 3.4 Implement `recordResponse(agentId, responseHash)` method
- [x] 3.5 Implement `checkLoop(agentId, promptHash, toolCalls): LoopCheckResult` with scoring
- [x] 3.6 Add configurable thresholds (window_size, score_threshold)

## 4. Proxy Integration (packages/proxy)

- [x] 4.1 Import LoopDetector in `proxy-server.ts`
- [x] 4.2 Fetch kill_switch config from server for each agent
- [x] 4.3 Call `checkLoop()` before forwarding request
- [x] 4.4 Return 429 with `block_reason: "loop_detected"` when triggered
- [x] 4.5 Call `recordResponse()` after receiving LLM response
- [x] 4.6 Emit kill_switch event to server when triggered

## 5. Database Schema (packages/server)

- [x] 5.1 Add `kill_switch_enabled` column to agent_policies (default false)
- [x] 5.2 Add `kill_switch_window_size` column (default 20)
- [x] 5.3 Add `kill_switch_threshold` column (default 10.0)
- [x] 5.4 Add migration logic for existing databases

## 6. Server API (packages/server)

- [x] 6.1 Add GET `/api/agents/:id/kill-switch` endpoint
- [x] 6.2 Add PATCH `/api/agents/:id/kill-switch` endpoint
- [x] 6.3 Add kill_switch fields to existing agent policy responses
- [x] 6.4 Add db helper functions for kill_switch CRUD

## 7. Alert Integration (packages/server)

- [x] 7.1 Add `kill_switch` to alert rule type enum
- [x] 7.2 Create `evaluateKillSwitchAlert()` function
- [x] 7.3 Add event handler for kill_switch trigger events
- [x] 7.4 Include loop_score, window_size in alert payload

## 8. Dashboard UI (apps/dashboard-local)

- [x] 8.1 Add Kill Switch section to AgentDetailPage
- [x] 8.2 Implement toggle with notification check:
  - On enable, check if alert rules exist
  - Show prompt if no notifications configured
- [x] 8.3 Add window_size input (number, min 5, max 100)
- [x] 8.4 Add threshold input (number, min 1, max 50)
- [x] 8.5 Add API client functions for kill_switch endpoints
- [x] 8.6 Show kill_switch status in agent list (killed badge if active)

## 9. Testing

- [x] 9.1 Add unit tests for SimHash algorithm
- [x] 9.2 Add unit tests for prompt normalization
- [x] 9.3 Add unit tests for LoopDetector scoring
- [x] 9.4 Add integration test for kill switch flow
