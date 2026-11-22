#!/bin/zsh
# ショートカット「content.md」（⌃⌥G）から呼ばれる。
# 選んでいる文を自動でコピー（⌘C）して、置き場に置く。送るのは launchd の係（send-outbox.sh）が iMessage で。
# 何も選んでいなければ何も送らない。あなたのクリップボードは元に戻す。
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
LOG=/tmp/content-md-shortcut.log
OUT="$HOME/Library/Application Support/content-md/outbox"
count() { /usr/bin/osascript -l JavaScript -e 'ObjC.import("AppKit"); $.NSPasteboard.generalPasteboard.changeCount' }
{
  echo "--- $(date '+%F %T')"
  saved="$(/usr/bin/pbpaste)"; before=$(count)
  sleep 0.2   # ⌃⌥ から指が離れるのを待つ
  /usr/bin/osascript -l JavaScript -e 'ObjC.import("ApplicationServices");
    for (const down of [true,false]) { const e=$.CGEventCreateKeyboardEvent(null,8,down); $.CGEventSetFlags(e,$.kCGEventFlagMaskCommand); $.CGEventPost($.kCGHIDEventTap,e) }'
  for i in {1..20}; do [ "$(count)" != "$before" ] && break; sleep 0.05; done
  if [ "$(count)" = "$before" ]; then echo "nothing selected"; exit 0; fi
  text="$(/usr/bin/pbpaste)"
  printf %s "$saved" | /usr/bin/pbcopy
  echo "len=${#text}"
  [ -z "$(printf %s "$text" | tr -d '[:space:]')" ] && { echo "empty"; exit 0; }
  mkdir -p "$OUT" && printf %s "$text" > "$OUT/.$$.tmp" && mv "$OUT/.$$.tmp" "$OUT/$(date +%s)-$$.txt" && echo "queued"
} >> "$LOG" 2>&1
