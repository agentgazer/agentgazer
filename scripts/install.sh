#!/bin/sh
# AgentGazer install script
# Usage: curl -fsSL https://agentgazer.com/install.sh | sh
#
# This script:
#   1. Detects your platform (macOS/Linux, x64/arm64)
#   2. Downloads Node.js if not present or < 18
#   3. Installs agentgazer via npm into ~/.agentgazer/lib/
#   4. Creates a wrapper script at /usr/local/bin/agentgazer
#
# Environment variables:
#   AGENTGAZER_HOME   Install directory (default: ~/.agentgazer)
#   AGENTGAZER_BIN    Wrapper location (default: /usr/local/bin)

set -e

# --- Configuration -----------------------------------------------------------

NODE_VERSION="24.13.0"
AGENTGAZER_HOME="${AGENTGAZER_HOME:-$HOME/.agentgazer}"
AGENTGAZER_BIN="${AGENTGAZER_BIN:-/usr/local/bin}"
NODE_DIR="$AGENTGAZER_HOME/node"
LIB_DIR="$AGENTGAZER_HOME/lib"
WRAPPER_PATH="$AGENTGAZER_BIN/agentgazer"

# --- Helpers ------------------------------------------------------------------

info() {
  printf '  \033[1;34m>\033[0m %s\n' "$1"
}

success() {
  printf '  \033[1;32m✓\033[0m %s\n' "$1"
}

error() {
  printf '  \033[1;31m✗\033[0m %s\n' "$1" >&2
}

# --- Platform detection -------------------------------------------------------

detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Darwin) PLATFORM_OS="darwin" ;;
    Linux)  PLATFORM_OS="linux" ;;
    *)
      error "Unsupported operating system: $OS"
      echo ""
      echo "  Supported platforms:"
      echo "    - macOS (darwin-arm64, darwin-x64)"
      echo "    - Linux (linux-x64, linux-arm64)"
      echo ""
      echo "  For other platforms, install via npm:"
      echo "    npm install -g @agentgazer/cli"
      exit 1
      ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  PLATFORM_ARCH="x64" ;;
    arm64|aarch64) PLATFORM_ARCH="arm64" ;;
    *)
      error "Unsupported architecture: $ARCH"
      echo ""
      echo "  Supported architectures: x64, arm64"
      echo "  For other architectures, install via npm:"
      echo "    npm install -g @agentgazer/cli"
      exit 1
      ;;
  esac

  PLATFORM="${PLATFORM_OS}-${PLATFORM_ARCH}"
}

# --- Node.js version check ---------------------------------------------------

check_node() {
  if command -v node >/dev/null 2>&1; then
    NODE_CURRENT="$(node -v 2>/dev/null | sed 's/^v//')"
    NODE_MAJOR="$(echo "$NODE_CURRENT" | cut -d. -f1)"
    if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
      SYSTEM_NODE="$(command -v node)"
      return 0
    fi
  fi
  return 1
}

# --- Download Node.js ---------------------------------------------------------

download_node() {
  info "Downloading Node.js v${NODE_VERSION} for ${PLATFORM}..."

  NODE_TARBALL="node-v${NODE_VERSION}-${PLATFORM}.tar.xz"
  NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"

  TMPDIR_DL="$(mktemp -d)"
  trap 'rm -rf "$TMPDIR_DL"' EXIT

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$NODE_URL" -o "$TMPDIR_DL/$NODE_TARBALL"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$NODE_URL" -O "$TMPDIR_DL/$NODE_TARBALL"
  else
    error "Neither curl nor wget found. Cannot download Node.js."
    exit 1
  fi

  mkdir -p "$NODE_DIR"
  tar -xJf "$TMPDIR_DL/$NODE_TARBALL" -C "$TMPDIR_DL"
  # Move contents (strip one directory level)
  rm -rf "$NODE_DIR"
  mv "$TMPDIR_DL/node-v${NODE_VERSION}-${PLATFORM}" "$NODE_DIR"

  rm -rf "$TMPDIR_DL"
  trap - EXIT

  success "Node.js v${NODE_VERSION} installed to $NODE_DIR"
}

# --- Resolve which node/npm to use -------------------------------------------

resolve_node() {
  if check_node; then
    RESOLVED_NODE="$SYSTEM_NODE"
    RESOLVED_NPM="$(dirname "$SYSTEM_NODE")/npm"
    success "Using system Node.js v${NODE_CURRENT}"
  else
    if [ -x "$NODE_DIR/bin/node" ]; then
      NODE_EXISTING="$("$NODE_DIR/bin/node" -v 2>/dev/null | sed 's/^v//')"
      NODE_EXISTING_MAJOR="$(echo "$NODE_EXISTING" | cut -d. -f1)"
      if [ "$NODE_EXISTING_MAJOR" -ge 18 ] 2>/dev/null; then
        RESOLVED_NODE="$NODE_DIR/bin/node"
        RESOLVED_NPM="$NODE_DIR/bin/npm"
        success "Using existing embedded Node.js v${NODE_EXISTING}"
        return
      fi
    fi
    download_node
    RESOLVED_NODE="$NODE_DIR/bin/node"
    RESOLVED_NPM="$NODE_DIR/bin/npm"
  fi
}

# --- Install agentgazer via npm -----------------------------------------------

install_agentgazer() {
  info "Installing agentgazer..."

  mkdir -p "$LIB_DIR"

  # Clear any cached versions to ensure fresh install
  "$RESOLVED_NODE" "$RESOLVED_NPM" cache clean --force 2>/dev/null || true

  # Remove old installation to force fresh dependency resolution
  rm -rf "$LIB_DIR/lib/node_modules/@agentgazer" 2>/dev/null || true

  # Use the resolved node to run npm install
  "$RESOLVED_NODE" "$RESOLVED_NPM" install -g @agentgazer/cli@latest \
    --prefix "$LIB_DIR" \
    --loglevel error 2>&1

  if [ ! -f "$LIB_DIR/lib/node_modules/@agentgazer/cli/dist/cli.js" ]; then
    error "Installation failed — cli.js not found"
    exit 1
  fi

  success "agentgazer installed to $LIB_DIR"
}

# --- Create wrapper script ----------------------------------------------------

create_wrapper() {
  # Wrapper uses same logic as install: prefer system node >= 18, else bundled
  WRAPPER_CONTENT='#!/bin/sh
# AgentGazer wrapper — auto-generated by install.sh
AGENTGAZER_HOME="${AGENTGAZER_HOME:-'"$HOME"'/.agentgazer}"

# Check system node first (same logic as installer)
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v 2>/dev/null | sed "s/^v//" | cut -d. -f1)"
  if [ "$NODE_MAJOR" -ge 18 ] 2>/dev/null; then
    NODE="$(command -v node)"
  fi
fi

# Fall back to bundled node
if [ -z "$NODE" ] && [ -x "$AGENTGAZER_HOME/node/bin/node" ]; then
  NODE="$AGENTGAZER_HOME/node/bin/node"
fi

if [ -z "$NODE" ]; then
  echo "Error: Node.js >= 18 not found. Re-run the AgentGazer install script." >&2
  exit 1
fi

exec "$NODE" "$AGENTGAZER_HOME/lib/lib/node_modules/@agentgazer/cli/dist/cli.js" "$@"
'

  # Try without sudo first
  if mkdir -p "$AGENTGAZER_BIN" 2>/dev/null && \
     printf '%s' "$WRAPPER_CONTENT" > "$WRAPPER_PATH" 2>/dev/null && \
     chmod +x "$WRAPPER_PATH" 2>/dev/null; then
    success "Wrapper created at $WRAPPER_PATH"
  else
    info "Need elevated permissions to write to $AGENTGAZER_BIN"
    sudo sh -c "mkdir -p '$AGENTGAZER_BIN' && printf '%s' '$WRAPPER_CONTENT' > '$WRAPPER_PATH' && chmod +x '$WRAPPER_PATH'"
    success "Wrapper created at $WRAPPER_PATH (via sudo)"
  fi
}

# --- Main ---------------------------------------------------------------------

main() {
  echo ""
  echo "  AgentGazer Installer"
  echo "  ─────────────────────────────────"
  echo ""

  detect_platform
  info "Detected platform: $PLATFORM"

  resolve_node

  install_agentgazer

  create_wrapper

  # Get version
  AT_VERSION="$("$RESOLVED_NODE" "$LIB_DIR/lib/node_modules/@agentgazer/cli/dist/cli.js" version 2>/dev/null || echo "unknown")"

  echo ""
  echo "  ─────────────────────────────────"
  success "AgentGazer $AT_VERSION installed!"
  echo ""
  echo "  Get started:"
  echo "    agentgazer              Launch AgentGazer (server + proxy + dashboard)"
  echo ""
  echo "  Useful commands:"
  echo "    agentgazer onboard      First-time setup"
  echo "    agentgazer doctor       Check system health"
  echo "    agentgazer --help       Show all commands"
  echo ""
  echo "  To uninstall:"
  echo "    agentgazer uninstall"
  echo ""
}

main
