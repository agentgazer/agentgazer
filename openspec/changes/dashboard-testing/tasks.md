## 1. Test Infrastructure

- [ ] 1.1 Add Vitest config for dashboard (`vitest.config.ts` with jsdom environment)
- [ ] 1.2 Add `@testing-library/react`, `@testing-library/jest-dom` as devDependencies
- [ ] 1.3 Update `package.json` test script from `echo` to `vitest run`
- [ ] 1.4 Add test setup file for React Testing Library matchers

## 2. Utility & Hook Tests

- [ ] 2.1 Test date/number formatting utilities
- [ ] 2.2 Test API client functions (mock fetch)
- [ ] 2.3 Test i18n setup (EN/ZH locale switching)

## 3. Component Tests

- [ ] 3.1 Test OverviewPage: renders stats cards with mock data
- [ ] 3.2 Test AgentsPage: renders agent list, handles empty state
- [ ] 3.3 Test SecurityPage: renders security config, toggle interactions
- [ ] 3.4 Test AlertsPage: renders alert rules, create/delete flow
- [ ] 3.5 Test LoginPage: form validation, submit behavior

## 4. Verification

- [ ] 4.1 Run `npm run test` in dashboard and verify all tests pass
- [ ] 4.2 Verify tests run in CI environment (no browser dependency)
