# Cross-Provider Model Override - Tasks

## Database & API

- [x] Add `target_provider` column migration to `db.ts`
- [x] Update `ModelRuleRow` type to include `target_provider`
- [x] Update `getModelRule()` to return `target_provider`
- [x] Update `upsertModelRule()` to accept `target_provider`
- [x] Update `model-rules.ts` PUT endpoint to handle `target_provider`
- [x] Update `model-rules.ts` GET endpoints to return `target_provider`

## Format Converter (packages/shared)

- [x] Create `format-converter.ts` with types for OpenAI and Anthropic formats
- [x] Implement `openaiToAnthropic(request)` - request transformation
- [x] Implement `anthropicToOpenai(response)` - non-streaming response transformation
- [x] Implement `anthropicSseToOpenaiSse(chunk)` - streaming chunk transformation
- [x] Add unit tests for format converter

## Proxy Changes

- [x] Update `getModelOverride()` to return `targetProvider` along with model
- [x] Add cross-provider detection logic in request handler
- [x] Implement request transformation before forwarding
- [x] Implement non-streaming response transformation
- [x] Implement streaming SSE transformation (real-time chunk conversion)
- [x] Handle target provider API key lookup
- [x] Add logging for cross-provider routing

## Dashboard UI

- [x] Update `ModelSettings.tsx` to fetch all provider models
- [x] Change dropdown to grouped format with `<optgroup>` by provider
- [x] Parse `provider:model` value format on selection
- [x] Send `target_provider` in PUT request
- [x] Display target provider info in UI when cross-provider override is active

## Testing

- [x] Test OpenAI → Anthropic request conversion (16 unit tests in format-converter.test.ts)
- [x] Test Anthropic → OpenAI response conversion (16 unit tests in format-converter.test.ts)
- [x] Test streaming SSE conversion (16 unit tests in format-converter.test.ts)
- [x] Test cross-provider routing end-to-end (automated tests added)
- [x] Test same-provider override still works (automated test added)
