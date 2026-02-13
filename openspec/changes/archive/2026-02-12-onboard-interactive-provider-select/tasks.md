## 1. Build Provider Choices

- [x] 1.1 Create helper function to check if provider is configured (check secret store)
- [x] 1.2 Create helper function to build inquirer choices array with proper labels

## 2. Replace Sequential Prompts

- [x] 2.1 Replace the for-loop in `cmdOnboard()` with inquirer checkbox prompt
- [x] 2.2 Filter selected providers to exclude OAuth providers
- [x] 2.3 Loop through filtered selection and prompt for API keys

## 3. Test and Verify

- [x] 3.1 Test with no providers selected (should complete with 0 configured)
- [x] 3.2 Test with OAuth provider selected (should skip API key prompt)
- [x] 3.3 Test re-configuring an already-configured provider
