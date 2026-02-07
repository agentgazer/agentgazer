#!/bin/sh
# AgentGazer uninstall script
# Removes the curl-installed AgentGazer files.
# User data (config.json, data.db) is preserved unless you confirm removal.

set -e

AGENTGAZER_HOME="${AGENTGAZER_HOME:-$HOME/.agentgazer}"
WRAPPER_PATH="${AGENTGAZER_BIN:-/usr/local/bin}/agentgazer"

info() {
  printf '  \033[1;34m>\033[0m %s\n' "$1"
}

success() {
  printf '  \033[1;32m✓\033[0m %s\n' "$1"
}

warn() {
  printf '  \033[1;33m!\033[0m %s\n' "$1"
}

echo ""
echo "  AgentGazer Uninstaller"
echo "  ─────────────────────────────────"
echo ""

# Check if curl-installed (lib/ directory exists)
if [ ! -d "$AGENTGAZER_HOME/lib" ]; then
  warn "No curl-based installation found at $AGENTGAZER_HOME/lib"
  echo ""
  echo "  If you installed via npm, run:"
  echo "    npm uninstall -g @agentgazer/cli"
  echo ""
  echo "  If you installed via Homebrew, run:"
  echo "    brew uninstall agentgazer"
  echo ""
  exit 0
fi

# Remove embedded Node.js
if [ -d "$AGENTGAZER_HOME/node" ]; then
  rm -rf "$AGENTGAZER_HOME/node"
  success "Removed embedded Node.js ($AGENTGAZER_HOME/node)"
else
  info "No embedded Node.js found (skipped)"
fi

# Remove installed lib
rm -rf "$AGENTGAZER_HOME/lib"
success "Removed agentgazer installation ($AGENTGAZER_HOME/lib)"

# Remove wrapper script
if [ -f "$WRAPPER_PATH" ]; then
  if rm "$WRAPPER_PATH" 2>/dev/null; then
    success "Removed wrapper ($WRAPPER_PATH)"
  else
    info "Need elevated permissions to remove $WRAPPER_PATH"
    sudo rm "$WRAPPER_PATH"
    success "Removed wrapper ($WRAPPER_PATH) (via sudo)"
  fi
else
  info "No wrapper found at $WRAPPER_PATH (skipped)"
fi

# Prompt for user data
echo ""
HAS_DATA=false
[ -f "$AGENTGAZER_HOME/config.json" ] && HAS_DATA=true
[ -f "$AGENTGAZER_HOME/data.db" ] && HAS_DATA=true

if [ "$HAS_DATA" = true ]; then
  echo "  User data found:"
  [ -f "$AGENTGAZER_HOME/config.json" ] && echo "    - $AGENTGAZER_HOME/config.json (auth token, provider config)"
  [ -f "$AGENTGAZER_HOME/data.db" ] && echo "    - $AGENTGAZER_HOME/data.db (event history)"
  echo ""
  printf "  Remove user data? [y/N] "
  read -r REPLY
  case "$REPLY" in
    [yY]|[yY][eE][sS])
      rm -rf "$AGENTGAZER_HOME"
      success "Removed all data ($AGENTGAZER_HOME)"
      ;;
    *)
      info "User data preserved at $AGENTGAZER_HOME"
      ;;
  esac
else
  # No user data, clean up empty dir if possible
  rmdir "$AGENTGAZER_HOME" 2>/dev/null || true
fi

echo ""
success "AgentGazer uninstalled."
echo ""
