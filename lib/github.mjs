// content.md に1つの箇条書きを足して、1つのコミットにする。
// 同じメッセージが2回届いても2回足さないよう、受け取ったメッセージの id を .ids に残す。
const API = "https://api.github.com";
const REPO = process.env.CONTENT_REPO ?? "ryuzo-k/content-md";
const BRANCH = "main";

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

// 足せたら "added"、もう足してあれば "duplicate" を返す。
export async function addBullet({ id, bullet, appendBullet }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = await gh(`/git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const ids = await readFile(head, ".ids");
    if (ids.split("\n").includes(id)) return "duplicate";
    const content = await readFile(head, "content.md");
    const commit = await gh(`/git/commits/${head}`);
    const tree = await gh(`/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: commit.tree.sha,
        tree: [
          { path: "content.md", mode: "100644", type: "blob", content: appendBullet(content, bullet) },
          { path: ".ids", mode: "100644", type: "blob", content: (ids && !ids.endsWith("\n") ? ids + "\n" : ids) + id + "\n" },
        ],
      }),
    });
    const next = await gh(`/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message: "Add to content.md", tree: tree.sha, parents: [head] }),
    });
    try {
      await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: next.sha, force: false }) });
      return "added";
    } catch (e) {
      if (e.status === 422) continue; // 同時に別のメッセージが入った。読み直してやり直す
      throw e;
    }
  }
  throw new Error("content.md: 5回やり直しても書き込めなかった");
}
