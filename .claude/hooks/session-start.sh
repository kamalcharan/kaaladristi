#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install frontend (npm) dependencies
if [ -f "$CLAUDE_PROJECT_DIR/ui prototype/App/frontend/package.json" ]; then
  cd "$CLAUDE_PROJECT_DIR/ui prototype/App/frontend"
  npm install --no-audit --no-fund
fi

# Install Python dependencies
if [ -f "$CLAUDE_PROJECT_DIR/ui prototype/App/backend/requirements.txt" ]; then
  pip install -q -r "$CLAUDE_PROJECT_DIR/ui prototype/App/backend/requirements.txt"
fi
