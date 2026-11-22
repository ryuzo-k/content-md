#!/bin/zsh
# ショートカット「content.md」から呼ばれる。受け取った文（無ければクリップボード）を置き場に置く。
# 送るのは launchd の係（send-outbox.sh）。動きの記録は /tmp/content-md-shortcut.log に残す。
LOG=/tmp/content-md-shortcut.log
OUT=/Users/ryuzokijima/Library/Application\ Support/content-md/outbox
{
  echo "--- $(date '+%F %T') pid=$$ HOME=$HOME"
  text="$(cat)"
  [ -z "$(printf %s "$text" | tr -d '[:space:]')" ] && text="$(/usr/bin/pbpaste)"
  echo "len=${#text}"
  if [ -n "$(printf %s "$text" | tr -d '[:space:]')" ]; then
    mkdir -p "$OUT" && printf %s "$text" > "$OUT/.$$.tmp" && mv "$OUT/.$$.tmp" "$OUT/$(date +%s)-$$.txt" && echo "queued"
  else
    echo "empty"
  fi
} >> "$LOG" 2>&1
