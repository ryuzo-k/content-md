// content.md に「1回の送信＝1つの箇条書き」で足して、1つのコミットにする。
//
// iPhone は、リンクとそれに続けて打った文を、1回の送信でも別々のメッセージに分けて送る
// （リンクの見出しを付けるため）。分かれたメッセージは同じ瞬間に作られる（試しでは 0.23 秒差）。
// そこで、作られた時刻が SAME_SEND_MS 以内のメッセージは同じ送信とみなし、1つの箇条書きにまとめる。
//
// まとめるために、最後の箇条書きの元（メッセージと時刻）を .last.json に、
// 足し終えたメッセージの id を .ids に残す（同じメッセージが2回届いても2回足さない）。
import { toBullet, appendBullet } from "./bullet.mjs";

const API = "https://api.github.com";
const REPO = process.env.CONTENT_REPO ?? "ryuzo-k/content-md";
const BRANCH = "main";
export const SAME_SEND_MS = 1000;

async function gh(path, init = {}) {
  const res = await fetch(`${API}/repos/${REPO}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${init.method ?? "GET"} ${path} -> ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function readFile(ref, path) {
  try {
    const f = await gh(`/contents/${path}?ref=${ref}`);
    return Buffer.from(f.content, "base64").toString("utf8");
  } catch (e) {
    if (e.status === 404) return "";
    throw e;
  }
}

// 今の content.md・最後の箇条書きの元・新しいメッセージから、次の content.md と .last.json を作る（GitHub を触らない部分）
export function nextState(content, last, msg) {
  const t = Date.parse(msg.time);
  const sameSend = last && last.parts.length && Math.abs(t - Math.max(...last.parts.map((p) => p.t))) <= SAME_SEND_MS && content.endsWith(last.bullet + "\n");
  const parts = (sameSend ? [...last.parts, { t, text: msg.text }] : [{ t, text: msg.text }]).sort((a, b) => a.t - b.t);
  const bullet = toBullet(parts.map((p) => p.text).join("\n"));
  if (!bullet) return null;
  const base = sameSend ? content.slice(0, content.length - (last.bullet.length + 1)) : content;
  return { content: appendBullet(base, bullet), last: { parts, bullet } };
}

// 足せたら "added"、もう足してあれば "duplicate"、中身が空なら "empty" を返す。
export async function addMessage(msg) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const ref = await gh(`/git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const ids = await readFile(head, ".ids");
    if (ids.split("\n").includes(msg.id)) return "duplicate";
    const content = await readFile(head, "content.md");
    const lastRaw = await readFile(head, ".last.json");
    const next = nextState(content, lastRaw ? JSON.parse(lastRaw) : null, msg);
    if (!next) return "empty";
    const commit = await gh(`/git/commits/${head}`);
    const tree = await gh(`/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: commit.tree.sha,
        tree: [
          { path: "content.md", mode: "100644", type: "blob", content: next.content },
          { path: ".last.json", mode: "100644", type: "blob", content: JSON.stringify(next.last) + "\n" },
          { path: ".ids", mode: "100644", type: "blob", content: (ids && !ids.endsWith("\n") ? ids + "\n" : ids) + msg.id + "\n" },
        ],
      }),
    });
    const made = await gh(`/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: "Add to content.md", tree: tree.sha, parents: [head] }),
    });
    try {
      await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: made.sha, force: false }) });
      return "added";
    } catch (e) {
      if (e.status === 422) continue; // 同じ送信のもう片方が先に書いた。読み直して、まとめてやり直す
      throw e;
    }
  }
  throw new Error("content.md: 6回やり直しても書き込めなかった");
}
