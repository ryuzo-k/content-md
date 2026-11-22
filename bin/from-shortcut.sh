#!/bin/zsh
# ショートカット「content.md」から呼ばれる。クリップボードの文を置き場に置く。
# 送るのは launchd の係（send-outbox.sh）。動きの記録は /tmp/content-md-shortcut.log に残す。
# ショートカットから動くと LANG が無く、pbpaste が Shift_JIS で出して、Shift_JIS に無い字（⚪︎ など）が ? に化ける。UTF-8 を名指しする。
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
LOG=/tmp/content-md-shortcut.log
OUT=/Users/ryuzokijima/Library/Application\ Support/content-md/outbox
{
  echo "--- $(date '+%F %T') pid=$$ HOME=$HOME"
  text="$(cat)"
  printf %s "$text" | iconv -f UTF-8 -t UTF-8 >/dev/null 2>&1 || { echo "stdin not utf8"; text=""; }
  src=input
  # キーで動かすと選んだ文は渡ってこないので、使い方は「⌘C でコピー → ⌃⌥G」。クリップボードを UTF-8 で読む。
  # ショートカットから文を渡す形にすると、押すたびに「リッチテキスト項目をシェルスクリプトで使用することを許可しますか」が出るので、渡さない。
  [ -z "$(printf %s "$text" | tr -d '[:space:]')" ] && { text="$(/usr/bin/pbpaste)"; src=clipboard; }
  echo "src=$src"
  echo "len=${#text}"
  if [ -n "$(printf %s "$text" | tr -d '[:space:]')" ]; then
    mkdir -p "$OUT" && printf %s "$text" > "$OUT/.$$.tmp" && mv "$OUT/.$$.tmp" "$OUT/$(date +%s)-$$.txt" && echo "queued"
  else
    echo "empty"
  fi
} >> "$LOG" 2>&1
