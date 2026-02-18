## 1. Sync Version Numbers

- [ ] 1.1 Update root `package.json` version from `0.5.5` to `0.6.0`
- [ ] 1.2 Update `@agentgazer/server`'s dependency on `@agentgazer/shared` from `0.5.5` to `0.6.0`
- [ ] 1.3 Audit all cross-package dependency versions for consistency
- [ ] 1.4 Run `npm install` to regenerate `package-lock.json`

## 2. Fix Express Type Mismatch

- [ ] 2.1 Evaluate: downgrade `@types/express` to `^4.x` or upgrade `express` to `^5.x`
- [ ] 2.2 Apply the chosen fix
- [ ] 2.3 Run `tsc --noEmit` on server package to verify no type errors
- [ ] 2.4 Fix any type errors introduced by the change

## 3. Verification

- [ ] 3.1 Run `npm run build` to verify all packages compile
- [ ] 3.2 Run `npm run test` to verify no regressions
