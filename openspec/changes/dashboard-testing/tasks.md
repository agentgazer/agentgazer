## 1. Test Infrastructure

- [x] 1.1 Add Vitest config for dashboard (`vitest.config.ts` with jsdom environment)
- [x] 1.2 Add `@testing-library/react`, `@testing-library/jest-dom` as devDependencies
- [x] 1.3 Update `package.json` test script from `echo` to `vitest run`
- [x] 1.4 Add test setup file for React Testing Library matchers

## 2. Utility & Hook Tests

- [x] 2.1 Test date/number formatting utilities
- [x] 2.2 Test API client functions (mock fetch)
- [x] 2.3 Test i18n setup (EN/ZH locale switching)

## 3. Component Tests

- [x] 3.1 Test OverviewPage: renders stats cards with mock data
- [x] 3.2 Test AgentsPage: renders agent list, handles empty state
- [x] 3.3 Test SecurityPage: renders security config, toggle interactions
- [x] 3.4 Test AlertsPage: renders alert rules, create/delete flow
- [x] 3.5 Test LoginPage: form validation, submit behavior

## 4. Verification

- [ ] 4.1 Run `npm run test` in dashboard and verify all tests pass
- [ ] 4.2 Verify tests run in CI environment (no browser dependency)
