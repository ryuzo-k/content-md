// 保存できたメッセージに、絵文字 ✅ のリアクション（Tapback）を付ける。
import { cloud } from "@spectrum-ts/core";
import { createGrpcClient } from "@photon-ai/advanced-imessage/grpc";

export const EMOJI = "✅";

export async function react(chatGuid, messageGuid) {
  const t = await cloud.issueImessageTokens(process.env.SPECTRUM_PROJECT_ID, process.env.SPECTRUM_PROJECT_SECRET);
  const address = process.env.SPECTRUM_IMESSAGE_ADDRESS ?? "imessage.spectrum.photon.codes:443";
  const im = createGrpcClient({ address, tls: true, token: async () => t.token });
  try {
    return await im.messages.setReaction(chatGuid, messageGuid, { kind: "emoji", emoji: EMOJI }, true);
  } finally {
    await im.close();
  }
}
