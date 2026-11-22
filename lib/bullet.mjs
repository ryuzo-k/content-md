// 1つのメッセージを、content.md の1つの箇条書きにする。中身は変えない。
// 2行目から先は字下げして同じ箇条書きの中に入れる（改行・空行・「* 」の箇条書きもそのまま）。
export function toBullet(text) {
  if (typeof text !== "string") return null;
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (!lines.length) return null;
  const [first, ...rest] = lines;
  return ["- " + first.trimStart(), ...rest.map((l) => (l === "" ? "" : "  " + l))].join("\n");
}

// 今の content.md の末尾に1つ足した中身を返す
export function appendBullet(current, bullet) {
  const base = current.length && !current.endsWith("\n") ? current + "\n" : current;
  return base + bullet + "\n";
}
