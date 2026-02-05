## 1. English Documentation

- [x] 1.1 Add "Security Architecture" section to `apps/docs/en/guide/providers.md` between "Key Storage" and "Rate Limiting" — include trust boundary comparison table (backend, who encrypts, who can decrypt, protection level) and runtime key lifecycle description
- [x] 1.2 Add FAQ entry to `apps/docs/en/guide/faq.md` Security section — "Do keys stay in memory after startup?" explaining decrypt-once lifecycle and no hot-reload

## 2. Chinese Documentation

- [x] 2.1 Add corresponding "安全架構" section to `apps/docs/zh/guide/providers.md` with same trust boundary table and runtime lifecycle
- [x] 2.2 Add corresponding FAQ entry to `apps/docs/zh/guide/faq.md` 安全性 section

## 3. CLI README

- [x] 3.1 Expand Security section in `packages/cli/README.md` with one-line trust boundary note per backend
