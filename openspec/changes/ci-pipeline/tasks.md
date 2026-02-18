## 1. GitHub Actions Workflow

- [x] 1.1 Create `.github/workflows/ci.yml` with Node.js 20 matrix
- [x] 1.2 Add `npm ci` step for dependency installation
- [x] 1.3 Add `npm run build` step to verify all packages compile
- [x] 1.4 Add `npm run lint` step (Turborepo)
- [x] 1.5 Add `npm run test` step (Turborepo)
- [x] 1.6 Configure workflow to trigger on PR and push to main

## 2. Fix CI Compatibility

- [x] 2.1 Ensure all test suites can run without external dependencies (SQLite in-memory, no network)
- [x] 2.2 Verify dashboard-local test script doesn't block CI (`echo 'No unit tests'` is fine)
- [x] 2.3 ~~Add TypeScript type-check script to root if not exists~~ — N/A: `tsc` is already part of `build` in each package; no separate `typecheck` task needed

## 3. Branch Protection (Optional)

- [ ] 3.1 Document recommended branch protection rules for main branch — deferred (requires repo admin)
- [ ] 3.2 Require CI to pass before merge — deferred (requires repo admin)

## 4. Verification

- [ ] 4.1 Create test PR to verify CI workflow runs correctly — deferred (will verify on next PR)
- [ ] 4.2 Verify CI fails on intentional test breakage — deferred (will verify on next PR)
