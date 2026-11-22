// Photon（Spectrum）から届いた iMessage を受け取る。
// 本人から届いた文のメッセージを content.md に1つの箇条書きとして足し、足せたら ✅ のリアクションを付ける。文の返信はしない。
import { verifySpectrumSignature, slimEnvelopeSchema } from "@spectrum-ts/core/webhook";
import { toBullet, appendBullet } from "../lib/bullet.mjs";
import { addBullet } from "../lib/github.mjs";
import { react } from "../lib/react.mjs";

export async function POST(request) {
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const headers = Object.fromEntries(request.headers);
  const check = await verifySpectrumSignature({ rawBody, headers, secret: process.env.SPECTRUM_WEBHOOK_SECRET });
  if (!check.ok) return new Response(check.reason, { status: 401 });

  const parsed = slimEnvelopeSchema.safeParse(JSON.parse(new TextDecoder().decode(rawBody)));
  if (!parsed.success) return new Response("ignored: shape", { status: 200 });
  const { message } = parsed.data;

  if (message.direction && message.direction !== "inbound") return new Response("ignored: outbound", { status: 200 });
  if (message.sender?.id !== process.env.OWNER_ID) return new Response("ignored: sender", { status: 200 });
  if (message.content.type !== "text") return new Response(`ignored: ${message.content.type}`, { status: 200 });

  const bullet = toBullet(message.content.text);
  if (!bullet) return new Response("ignored: empty", { status: 200 });

  const result = await addBullet({ id: message.id, bullet, appendBullet });
  if (result === "added") await react(message.space.id, message.id);
  return new Response(result, { status: 200 });
}
