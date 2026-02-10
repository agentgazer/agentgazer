# Cross-Provider Model Override

## Problem

Currently, the dashboard's model override feature only allows selecting models from the same provider. Users cannot route OpenAI requests to Anthropic Claude or vice versa.

## Solution

Extend the model override system to support cross-provider routing:
1. Add `target_provider` column to `agent_model_rules` table
2. Update Dashboard UI to show all models from all providers (grouped by provider)
3. Implement request/response format conversion in the proxy (OpenAI ↔ Anthropic)
4. Handle both streaming and non-streaming responses

## Scope

### In Scope
- Cross-provider override between OpenAI-compatible providers and Anthropic
- OpenAI ↔ Anthropic request format conversion
- OpenAI ↔ Anthropic response format conversion (including streaming SSE)
- Dashboard UI grouped dropdown showing all provider models

### Out of Scope
- Cohere support (low usage, defer to future)
- Google native API conversion (using OpenAI-compatible endpoint instead)
- A/B testing / traffic splitting
- Automatic fallback on provider failure

## Provider Compatibility

**OpenAI-compatible (no conversion needed):**
- OpenAI, Google Gemini, Mistral, DeepSeek, Moonshot, Zhipu, MiniMax, Baichuan

**Requires conversion:**
- Anthropic (Claude format)

## Success Criteria

- User can select any model from any provider in Dashboard
- Requests are correctly transformed and routed
- Responses are correctly transformed back to original format
- Streaming works correctly with format transformation
- Events are logged with both original and target provider/model info
