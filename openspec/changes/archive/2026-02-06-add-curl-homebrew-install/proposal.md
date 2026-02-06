## Why

AgentGazer currently requires Node.js and npm to install (`npm install -g agentgazer` or `npx agentgazer`). This excludes users who don't have Node.js — such as Python or Go agent developers — and adds friction compared to tools that offer `curl | sh` one-liner installation. To reach all users regardless of their runtime environment, we need platform-native install methods.

## What Changes

- Add a `curl | sh` install script that detects the platform, downloads a standalone Node.js binary to `~/.agentgazer/node/` if needed, installs agentgazer via npm into `~/.agentgazer/lib/`, creates a wrapper script at `/usr/local/bin/agentgazer`, and runs initial onboard
- Add a Homebrew tap repository structure so macOS/Linux users can `brew install agentgazer`
- Add an uninstall script to cleanly remove `~/.agentgazer/` and the wrapper
- Update documentation to feature all three install methods (curl, Homebrew, npm)
- Existing `npm install -g` and `npx agentgazer` paths remain unchanged

## Capabilities

### New Capabilities
- `install-script`: The curl|sh install script, uninstall script, and wrapper script for platform-independent installation
- `homebrew-tap`: Homebrew formula and tap repository structure for `brew install agentgazer`

### Modified Capabilities
- `cli-subcommands`: Add `agentgazer uninstall` subcommand that removes ~/.agentgazer/ and the wrapper script

## Impact

- New files: `install.sh`, `uninstall.sh` at project root (or `scripts/` directory)
- New directory: `homebrew/` with Formula definition
- Modified: `packages/cli/src/cli.ts` (add uninstall subcommand)
- Modified: VitePress docs (en/zh getting-started pages, possibly new install page)
- Modified: `docs/operation-guide-*.md` (add install methods)
- No changes to server, proxy, SDK, or dashboard code
- No breaking changes
