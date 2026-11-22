#!/bin/zsh
# Mac のクイックアクション（content.md）が置いた文を、iMessage を名指しして content.md の番号に送る。
# Chrome から動いたクイックアクションは、Chrome の決まりでメッセージを直接動かせない。
# そこで、クイックアクションは文をこのフォルダに置くだけにして、送るのはこの係（launchd）がやる。
OUT="$HOME/Library/Application Support/content-md/outbox"
for f in "$OUT"/*.txt(N); do
  /usr/bin/osascript - "$f" <<'AS' && rm -f "$f"
on run argv
	set t to read (POSIX file (item 1 of argv)) as «class utf8»
	tell application "Messages"
		send t to participant "+14156106180" of (1st account whose service type = iMessage)
	end tell
end run
AS
done
