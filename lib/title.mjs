// リンクだけの行に、そのページのタイトルを付けて [タイトル](URL) にする。
// タイトルはページの og:title、なければ <title>。取れなければ URL のまま（決まりはこれ1つ）。

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? m,
  );

function pick(html) {
  for (const re of [
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]*property=["']og:title["']/i,
    /<title[^>]*>([^<]*)<\/title>/i,
  ]) {
    const m = html.match(re);
    const t = m && decode(m[1]).replace(/\s+/g, " ").trim();
    if (t) return t;
  }
  return null;
}

export async function titleOf(url) {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", "accept-language": "en,ja;q=0.8" },
    });
    if (!res.ok) return null;
    return pick((await res.text()).slice(0, 3_000_000));
  } catch {
    return null;
  }
}

// リンクだけの行。Safari のアドレス欄から選ぶと https:// が付かない（youtube.com/watch?v=…）ので、それもリンクとして扱う。
const URL_ONLY = /^(\s*(?:- )?)((?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?)\s*$/i;
const full = (u) => (/^https?:\/\//i.test(u) ? u : "https://" + u);

// 文の中で、行がリンクだけのところを [タイトル](URL) にする
export async function withTitles(text) {
  const lines = text.split("\n");
  return (
    await Promise.all(
      lines.map(async (line) => {
        const m = line.match(URL_ONLY);
        if (!m) return line;
        const url = full(m[2]);
        const t = await titleOf(url);
        return t ? `${m[1]}[${t.replace(/([\[\]])/g, "\\$1")}](${url})` : line;
      }),
    )
  ).join("\n");
}
