// Mac のクイックアクション（Ctrl+G）から、選んだ文字をそのまま content.md に足す。
// iMessage と同じく「1回の送信＝1つの箇条書き」。合言葉（MAC_ADD_TOKEN）が合う時だけ受け取る。
import { randomUUID, timingSafeEqual } from "node:crypto";
import { addMessage } from "../lib/github.mjs";

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function POST(request) {
  const token = process.env.MAC_ADD_TOKEN;
  const auth = request.headers.get("authorization") ?? "";
  if (!token || !same(auth, `Bearer ${token}`)) return new Response("unauthorized", { status: 401 });
  const text = await request.text();
  const result = await addMessage({ id: `mac-${randomUUID()}`, time: new Date().toISOString(), text });
  return new Response(result, { status: result === "added" ? 200 : 422 });
}
