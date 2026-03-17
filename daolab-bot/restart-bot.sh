#!/bin/bash
BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$BOT_DIR/bot.pid"
LOG="$BOT_DIR/bot.log"

# Use system node or nvm node
NODE=$(which node)

# 1. Kill existing instances
pkill -9 -f 'daolab-bot/bot.mjs' 2>/dev/null
sleep 2

# 2. Verify clean
if pgrep -f 'daolab-bot/bot.mjs' > /dev/null; then
  echo "ERROR: process still alive"
  pgrep -af 'daolab-bot/bot.mjs'
  exit 1
fi

# 3. Start
cd "$BOT_DIR"
nohup "$NODE" bot.mjs >> "$LOG" 2>&1 &
NEW_PID=$!
echo $NEW_PID > "$PID_FILE"
sleep 2

# 4. Verify
if kill -0 $NEW_PID 2>/dev/null; then
  echo "✅ Bot started (PID: $NEW_PID)"
  tail -3 "$LOG"
else
  echo "❌ Start failed"
  tail -10 "$LOG"
fi
