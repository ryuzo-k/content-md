// 保存できたメッセージの上に、自分で作ったステッカーを貼る。
import { cloud } from "@spectrum-ts/core";
import { createGrpcClient } from "@photon-ai/advanced-imessage/grpc";
import fs from "node:fs";
import path from "node:path";

const STICKER = path.join(process.cwd(), "sticker.png");
export const PLACEMENT = { x: 0.95, y: 0.1, scale: 1, rotation: 0, width: 28 };

export async function placeSticker(chatGuid, messageGuid) {
  const t = await cloud.issueImessageTokens(process.env.SPECTRUM_PROJECT_ID, process.env.SPECTRUM_PROJECT_SECRET);
  const address = process.env.SPECTRUM_IMESSAGE_ADDRESS ?? "imessage.spectrum.photon.codes:443";
  const im = createGrpcClient({ address, tls: true, token: async () => t.token });
  try {
    const up = await im.attachments.upload({ fileName: "sticker.png", data: fs.readFileSync(STICKER) });
    const guid = up.attachment?.guid ?? up.guid;
    return await im.messages.placeSticker(chatGuid, messageGuid, guid, PLACEMENT);
  } finally {
    await im.close();
  }
}
