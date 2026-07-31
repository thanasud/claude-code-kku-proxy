#!/usr/bin/env bash
set -e

PROXY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROXY_PATH="$PROXY_DIR/proxy.mjs"
PLIST_LABEL="com.claudeproxy.local"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

NODE_PATH="$(command -v node || true)"
if [ -z "$NODE_PATH" ]; then
  echo "[ERROR] Node.js was not found in PATH. Install it from https://nodejs.org/ and try again."
  exit 1
fi

if [ ! -f "$PROXY_PATH" ]; then
  echo "[ERROR] proxy.mjs not found at $PROXY_PATH"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$PLIST_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_PATH</string>
    <string>$PROXY_PATH</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/claudeproxy.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/claudeproxy.err</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

echo ""
echo "Auto-start installed."
echo "The proxy will now start automatically (in the background, no window) at every login,"
echo "and restart itself if it ever crashes."
echo "Logs: /tmp/claudeproxy.log and /tmp/claudeproxy.err"
echo "To remove auto-start later, run: ./uninstall-autostart.sh"
echo ""
