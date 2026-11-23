// 今ある content.md の、リンクだけの行に一度だけタイトルを付ける（新しく届く分は lib/github.mjs が付ける）
import { readFileSync, writeFileSync } from "node:fs";
import { withTitles } from "../lib/title.mjs";
const path = new URL("../content.md", import.meta.url);
writeFileSync(path, await withTitles(readFileSync(path, "utf8")));
