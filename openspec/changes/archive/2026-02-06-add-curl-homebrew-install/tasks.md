## 1. Install Script

- [x] 1.1 Create `scripts/install.sh` with platform detection (darwin-arm64, darwin-x64, linux-x64, linux-arm64), error on unsupported platforms
- [x] 1.2 Add Node.js version check — skip download if system node >= 18, download Node.js LTS binary to `~/.agenttrace/node/` otherwise
- [x] 1.3 Add npm install logic — use resolved node to run `npm install -g agenttrace --prefix ~/.agenttrace/lib`
- [x] 1.4 Add wrapper script creation at `/usr/local/bin/agenttrace` with sudo fallback if permissions denied
- [x] 1.5 Add post-install message with version info and next steps (run `agenttrace` to start)
- [x] 1.6 Make install idempotent — re-run overwrites lib/node/wrapper, preserves config.json and data.db

## 2. Uninstall Script

- [x] 2.1 Create `scripts/uninstall.sh` that removes `~/.agenttrace/node/`, `~/.agenttrace/lib/`, and `/usr/local/bin/agenttrace` wrapper
- [x] 2.2 Add interactive prompt for user data removal (`config.json`, `data.db`), default to keeping data

## 3. CLI Uninstall Subcommand

- [x] 3.1 Add `agenttrace uninstall` subcommand to `packages/cli/src/cli.ts`
- [x] 3.2 Detect install method (curl vs npm) by checking for `~/.agenttrace/lib/` existence
- [x] 3.3 If curl-installed: remove node/, lib/, wrapper; prompt for data removal (skip prompt with `--yes`)
- [x] 3.4 If npm-installed: print message to use `npm uninstall -g agenttrace` and exit

## 4. Homebrew Tap

- [x] 4.1 Create `homebrew/Formula/agenttrace.rb` with desc, homepage, url (npm tarball), sha256, depends_on "node@22", and npm install method
- [x] 4.2 Add README to `homebrew/` explaining how to publish as a tap repository

## 5. Documentation

- [x] 5.1 Update VitePress getting-started (en/zh) to show all three install methods: curl, Homebrew, npm
- [x] 5.2 Update `docs/operation-guide-en.md` and `docs/operation-guide-zh.md` installation section with all three methods
- [x] 5.3 Add uninstall instructions to docs (curl uninstall, brew uninstall, npm uninstall)
