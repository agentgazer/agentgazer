## 1. Sync Version Numbers

- [x] 1.1 Update root `package.json` version from `0.5.5` to `0.6.0`
- [x] 1.2 Update `@agentgazer/server`'s dependency on `@agentgazer/shared` from `0.5.5` to `0.6.0`
- [x] 1.3 Audit all cross-package dependency versions for consistency
- [x] 1.4 Run `npm install` to regenerate `package-lock.json`

## 2. Fix Express Type Mismatch

- [x] 2.1 Evaluate: downgrade `@types/express` to `^4.x` or upgrade `express` to `^5.x`
- [x] 2.2 Apply the chosen fix
- [x] 2.3 Run `tsc --noEmit` on server package to verify no type errors — verified via `npm run build` (tsc is part of build)
- [x] 2.4 Fix any type errors introduced by the change — no type errors found

## 3. Verification

- [x] 3.1 Run `npm run build` to verify all packages compile — all 7 packages built successfully
- [x] 3.2 Run `npm run test` to verify no regressions — 274/283 pass; 9 failures are pre-existing in integration.test.ts (proxy not built)
