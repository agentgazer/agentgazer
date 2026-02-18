## 1. Fix Key Derivation Salt

- [x] 1.1 Generate random salt on first use and persist to `~/.agentgazer/config.json`
- [x] 1.2 Add migration: detect old fixed-salt encrypted secrets and re-encrypt with new salt
- [x] 1.3 Update `secret-store.ts` to read salt from config
- [ ] 1.4 Add test: two different machines produce different derived keys
- [ ] 1.5 Add test: migration from fixed salt to random salt preserves secrets

## 2. Default Data Masking

- [x] 2.1 Update `DEFAULT_SECURITY_CONFIG` to enable `api_key` and `credit_card` masking by default
- [x] 2.2 Ensure existing user configs are not overwritten (only applies to new installations)
- [ ] 2.3 Add test: new agent gets default masking enabled
- [ ] 2.4 Update docs to reflect new defaults

## 3. Webhook HMAC Signing

- [x] 3.1 Add `webhook_secret` field to alert rule configuration
- [x] 3.2 Implement HMAC-SHA256 signing for webhook payloads
- [x] 3.3 Include `X-AgentGazer-Signature` header in webhook requests
- [ ] 3.4 Add webhook secret generation in Dashboard alert settings
- [ ] 3.5 Update docs with webhook verification example (Node.js, Python)
- [ ] 3.6 Add test: webhook payload signature can be verified
- [ ] 3.7 Add test: tampered payload fails verification

## 4. Verification

- [ ] 4.1 Run full test suite
- [ ] 4.2 Test on Linux headless environment (Docker)
