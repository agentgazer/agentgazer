## 1. Remove Yi Provider

- [x] 1.1 Remove Yi from KNOWN_PROVIDER_NAMES in packages/shared/src/providers.ts
- [x] 1.2 Remove Yi pricing data from packages/shared/src/pricing.ts
- [x] 1.3 Remove Yi from provider detection/validation if present

## 2. Add Model Names to Provider Display

- [x] 2.1 Create PROVIDER_MODEL_NAMES mapping in packages/shared/src/providers.ts
- [x] 2.2 Update cmdOnboard in packages/cli/src/cli.ts to display "provider (Model)" format
- [x] 2.3 Update provider add command to show model names if applicable

## 3. Add ASCII Logo

- [x] 3.1 Create ASCII logo constant with ANSI color codes in packages/cli/src/cli.ts
- [x] 3.2 Display logo at start of cmdOnboard before setup info
- [x] 3.3 Test logo renders correctly in terminal

## 4. Verification

- [x] 4.1 Run agentgazer onboard and verify logo displays
- [x] 4.2 Verify Yi is not listed in providers
- [x] 4.3 Verify all providers show model names
- [x] 4.4 Run npm test to ensure no regressions
