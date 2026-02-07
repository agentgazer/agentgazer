## Context

AgentGazer currently has rate limiting and budget controls, but no protection against AI agents stuck in semantic loops — repeatedly asking similar questions and getting similar responses. These loops can burn through API credits rapidly.

The existing architecture has:
- Proxy layer that intercepts all LLM requests
- Per-agent policy checks (active, budget, allowed hours, rate limits)
- Alert system with webhook/email delivery

## Goals / Non-Goals

**Goals:**
- Detect repetitive request patterns without using LLM calls
- Automatically block requests when loop is detected (hard kill)
- Notify users via existing alert system
- Configurable per-agent with sensible defaults
- Minimal latency impact (<1ms per request)

**Non-Goals:**
- Semantic understanding of prompts (too expensive)
- Detecting all possible loop patterns (focus on common cases)
- Soft kill / throttling (keep it simple for v1)
- Machine learning models (pure algorithmic approach)

## Decisions

### 1. SimHash for Similarity Detection

**Decision:** Use SimHash (64-bit) with Hamming distance for fuzzy matching.

**Alternatives considered:**
- Exact hash: Too strict, won't catch slight variations
- MinHash: Better for set similarity, but SimHash is simpler
- Embedding models: Accurate but requires ML dependency and adds latency
- Jaccard similarity: Slower for large texts

**Rationale:** SimHash is battle-tested (Google uses it for web deduplication), fast (pure CPU), and catches "almost identical" content. 64-bit hash with Hamming distance < 3 = similar.

### 2. Multi-Signal Scoring

**Decision:** Combine multiple signals with weighted scoring:

```
score = similar_prompts × 1.0
      + similar_responses × 2.0
      + repeated_tool_calls × 1.5
```

**Rationale:**
- Prompt repetition alone might be legitimate retries
- Response repetition is stronger signal (same Q → same A → still asking)
- Tool call repetition indicates stuck agent behavior
- Weighted scoring reduces false positives

### 3. Sliding Window Approach

**Decision:** Track last N requests (default: 20) per agent, not time-based window.

**Alternatives considered:**
- Time-based window (e.g., 60 seconds): Problematic for slow agents
- Fixed window: Loses context at boundaries

**Rationale:** Request-count window works regardless of agent speed. A slow agent making 20 identical requests over 10 minutes is just as stuck as a fast one doing it in 10 seconds.

### 4. Detection in Proxy Layer

**Decision:** Perform loop detection in proxy before forwarding request.

**Alternatives considered:**
- Server-side detection: Would need to sync state with proxy
- Post-response detection: Too late, already spent tokens

**Rationale:** Proxy already has request context and can block before API call is made. In-memory state is acceptable since it's per-process.

### 5. Prompt Normalization

**Decision:** Normalize before hashing:
- Lowercase
- Remove extra whitespace
- Replace numbers with `<NUM>`
- Replace UUIDs with `<ID>`
- Replace ISO timestamps with `<TS>`
- Extract last user message only (for multi-turn conversations)

**Rationale:** Catches loops where only dynamic values change (order IDs, timestamps, etc.)

### 6. Integration with Alert System

**Decision:** Add new alert rule type `kill_switch` that triggers when agent is killed.

**Rationale:** Reuse existing alert infrastructure (webhook, email, cooldown). Users configure once.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| False positives (killing legitimate agent) | High | Conservative default threshold; easy to disable; per-agent config |
| False negatives (missing some loop patterns) | Medium | Acceptable for v1; can tune thresholds |
| Memory usage for window state | Low | 20 requests × ~1KB = negligible per agent |
| SimHash collisions | Low | 64-bit hash space is huge; Hamming check adds safety |
| Proxy restart loses state | Low | Loops typically happen fast; state rebuilds quickly |

## Data Flow

```
Request → Normalize Prompt → SimHash → Check Window → Score
                                                        │
                                    score > threshold? ─┴─▶ KILL + Alert
                                                        │
                                                 No ────┴─▶ Forward + Record Response Hash
```

## Storage

**In-memory (Proxy):**
- Per-agent sliding window: `Map<agentId, CircularBuffer<RequestFingerprint>>`
- RequestFingerprint: `{ promptHash: bigint, responseHash: bigint, toolCalls: string[], timestamp: number }`

**SQLite (Server):**
- New columns in `agent_policies` or new table `agent_kill_switch`:
  - `kill_switch_enabled` (boolean)
  - `kill_switch_window_size` (int, default 20)
  - `kill_switch_threshold` (float, default 10.0)
