#!/usr/bin/env bash
set -e

PLIST_LABEL="com.claudeproxy.local"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
  rm "$PLIST_PATH"
  echo "Auto-start removed. The proxy will no longer start automatically at login."
else
  echo "Auto-start was not installed - nothing to remove."
fi
echo ""
