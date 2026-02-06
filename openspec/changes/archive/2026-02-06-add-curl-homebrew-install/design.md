## Context

AgentGazer installs via `npm install -g agentgazer` or runs via `npx agentgazer`. This requires Node.js >= 18 to be pre-installed. Users without Node.js (Python/Go developers, DevOps engineers) cannot use AgentGazer without first installing Node.js manually.

The project has a native dependency (`better-sqlite3`) which ships prebuilt binaries for common platforms via `prebuild-install`, so npm install works without a C++ toolchain on supported platforms.

## Goals / Non-Goals

**Goals:**
- Any user on macOS or Linux can install AgentGazer with a single command, without pre-existing Node.js
- The install script is self-contained and does not pollute the system (Node.js is scoped to `~/.agentgazer/`)
- Homebrew users on macOS/Linux can install via `brew install`
- Clean uninstall removes all traces
- Existing npm/npx install path remains unchanged

**Non-Goals:**
- Windows support (can be added later)
- Building a standalone single binary (future consideration — requires replacing better-sqlite3)
- Auto-update mechanism (out of scope for now)

## Decisions

### 1. Install location: `~/.agentgazer/`

All installed files live under `~/.agentgazer/`:

```
~/.agentgazer/
├── node/              # Embedded Node.js (only if system node < 18)
│   └── bin/node
├── lib/               # npm-installed agentgazer + dependencies
│   └── node_modules/
│       └── agentgazer/
├── config.json        # Already exists (auth token)
└── data.db            # Already exists (SQLite)
```

**Rationale**: Scoped install avoids conflicts with system Node.js or other tools. The `~/.agentgazer/` directory already exists for config/data, so adding `node/` and `lib/` is a natural extension.

### 2. Node.js source: Official distribution tarballs

Download from `https://nodejs.org/dist/vXX.YY.ZZ/node-vXX.YY.ZZ-{OS}-{ARCH}.tar.xz`.

Pin a specific LTS version (e.g., v22.x) in the install script. Only download if system node is missing or < 18.

Supported platforms:
- `darwin-arm64` (Apple Silicon)
- `darwin-x64` (Intel Mac)
- `linux-x64`
- `linux-arm64`

### 3. Wrapper script at `/usr/local/bin/agentgazer`

A thin shell wrapper that resolves the correct Node.js binary and executes the CLI:

```sh
#!/bin/sh
AGENTTRACE_HOME="${AGENTTRACE_HOME:-$HOME/.agentgazer}"
if [ -x "$AGENTTRACE_HOME/node/bin/node" ]; then
  NODE="$AGENTTRACE_HOME/node/bin/node"
else
  NODE="$(command -v node)"
fi
exec "$NODE" "$AGENTTRACE_HOME/lib/node_modules/agentgazer/dist/cli.js" "$@"
```

**Rationale**: A wrapper script (rather than symlink) lets us pick the right Node.js binary at runtime. If the user later installs system Node.js, we still use the embedded one for consistency.

### 4. Homebrew formula with `depends_on "node@22"`

The Homebrew formula declares Node.js as a dependency and installs via npm:

```ruby
class Agenttrace < Formula
  desc "Local-first AI agent observability platform"
  homepage "https://github.com/anthropics/agentgazer"
  url "https://registry.npmjs.org/agentgazer/-/agentgazer-0.1.0.tgz"
  depends_on "node@22"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end
end
```

Homebrew manages the Node.js dependency automatically. We create a tap repo (`homebrew-agentgazer`) containing the formula.

### 5. Uninstall: script + CLI subcommand

Two ways to uninstall:
- `agentgazer uninstall` — CLI subcommand, removes `~/.agentgazer/lib/`, `~/.agentgazer/node/`, and the wrapper script. Prompts before removing data (`config.json`, `data.db`)
- `uninstall.sh` — standalone script for when the CLI is broken

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Node.js download is ~40-60MB | Acceptable — Deno binary is 40MB+, Bun is 50MB+. Only downloaded if no system node |
| `better-sqlite3` prebuild may fail on exotic platforms | Only support the 4 major platform/arch combos. Fail gracefully with clear error |
| `/usr/local/bin` may need sudo on some systems | Script tries without sudo first, prompts for sudo if needed. Homebrew avoids this issue |
| Pinned Node.js version goes stale | Use current LTS. Document how to update. Consider an `agentgazer self-update` in the future |
| npm registry unavailable | Script shows clear error. User can retry or fall back to manual install |
