## Context

Rate limiting feature was implemented in `move-rate-limits-to-dashboard`. The feature allows:
- Per-agent per-provider rate limits configured via Dashboard
- Sliding window rate limiting with calculated retry-after
- Provider-specific 429 error responses (OpenAI/Anthropic format)

Documentation needs to be updated to reflect these new capabilities.

## Goals / Non-Goals

**Goals:**
- Document rate limit configuration in Dashboard (Agent Detail page)
- Document rate limit enforcement in Proxy (429 response format)
- Update README to mention the feature

**Non-Goals:**
- No code changes
- No new features

## Decisions

### Decision 1: Documentation structure

Add Rate Limit Settings as a new subsection in Agent Detail page documentation, after Model Settings (mirrors the actual UI layout).

Add Rate Limiting as a new section in Proxy documentation, after Policy Enforcement (rate limiting is a form of policy).

### Decision 2: Content to document

**Dashboard docs:**
- What rate limits do (limit requests per provider per time window)
- How to add/edit/remove rate limits
- UI controls description

**Proxy docs:**
- Sliding window mechanism
- 429 response format (provider-specific)
- `retry_after_seconds` calculation
- Block reason: `rate_limited`

**README:**
- Brief mention in features
- Link to proxy docs for details

## Risks / Trade-offs

No significant risks — documentation-only change.
