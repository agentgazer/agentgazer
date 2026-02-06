#!/bin/sh
# AgentTrace uninstall script
# Removes the curl-installed AgentTrace files.
# User data (config.json, data.db) is preserved unless you confirm removal.

set -e

AGENTTRACE_HOME="${AGENTTRACE_HOME:-$HOME/.agenttrace}"
WRAPPER_PATH="${AGENTTRACE_BIN:-/usr/local/bin}/agenttrace"

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
echo "  AgentTrace Uninstaller"
echo "  ─────────────────────────────────"
echo ""

# Check if curl-installed (lib/ directory exists)
if [ ! -d "$AGENTTRACE_HOME/lib" ]; then
  warn "No curl-based installation found at $AGENTTRACE_HOME/lib"
  echo ""
  echo "  If you installed via npm, run:"
  echo "    npm uninstall -g agenttrace"
  echo ""
  echo "  If you installed via Homebrew, run:"
  echo "    brew uninstall agenttrace"
  echo ""
  exit 0
fi

# Remove embedded Node.js
if [ -d "$AGENTTRACE_HOME/node" ]; then
  rm -rf "$AGENTTRACE_HOME/node"
  success "Removed embedded Node.js ($AGENTTRACE_HOME/node)"
else
  info "No embedded Node.js found (skipped)"
fi

# Remove installed lib
rm -rf "$AGENTTRACE_HOME/lib"
success "Removed agenttrace installation ($AGENTTRACE_HOME/lib)"

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
[ -f "$AGENTTRACE_HOME/config.json" ] && HAS_DATA=true
[ -f "$AGENTTRACE_HOME/data.db" ] && HAS_DATA=true

if [ "$HAS_DATA" = true ]; then
  echo "  User data found:"
  [ -f "$AGENTTRACE_HOME/config.json" ] && echo "    - $AGENTTRACE_HOME/config.json (auth token, provider config)"
  [ -f "$AGENTTRACE_HOME/data.db" ] && echo "    - $AGENTTRACE_HOME/data.db (event history)"
  echo ""
  printf "  Remove user data? [y/N] "
  read -r REPLY
  case "$REPLY" in
    [yY]|[yY][eE][sS])
      rm -rf "$AGENTTRACE_HOME"
      success "Removed all data ($AGENTTRACE_HOME)"
      ;;
    *)
      info "User data preserved at $AGENTTRACE_HOME"
      ;;
  esac
else
  # No user data, clean up empty dir if possible
  rmdir "$AGENTTRACE_HOME" 2>/dev/null || true
fi

echo ""
success "AgentTrace uninstalled."
echo ""
