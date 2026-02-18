## 1. GitHub Actions Workflow

- [ ] 1.1 Create `.github/workflows/ci.yml` with Node.js 20 matrix
- [ ] 1.2 Add `npm ci` step for dependency installation
- [ ] 1.3 Add `npm run build` step to verify all packages compile
- [ ] 1.4 Add `npm run lint` step (Turborepo)
- [ ] 1.5 Add `npm run test` step (Turborepo)
- [ ] 1.6 Configure workflow to trigger on PR and push to main

## 2. Fix CI Compatibility

- [ ] 2.1 Ensure all test suites can run without external dependencies (SQLite in-memory, no network)
- [ ] 2.2 Verify dashboard-local test script doesn't block CI (`echo 'No unit tests'` is fine)
- [ ] 2.3 Add TypeScript type-check script to root if not exists (`turbo typecheck` or per-package `tsc --noEmit`)

## 3. Branch Protection (Optional)

- [ ] 3.1 Document recommended branch protection rules for main branch
- [ ] 3.2 Require CI to pass before merge

## 4. Verification

- [ ] 4.1 Create test PR to verify CI workflow runs correctly
- [ ] 4.2 Verify CI fails on intentional test breakage
