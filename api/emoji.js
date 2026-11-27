const { withVpsFallback } = require("../lib/vpsBridge");
const zlib = require("zlib");

// In-memory cache for fast sub-millisecond serving of custom emojis
const emojiCache = new Map();

module.exports = withVpsFallback(async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { id } = req.query || {};
  const emojiId = String(id || "").trim();

  if (!emojiId || !/^\d+$/.test(emojiId)) {
    res.status(400).json({ error: "Invalid emoji ID" });
    return;
  }

  // Check cache first
  if (emojiCache.has(emojiId)) {
    const cached = emojiCache.get(emojiId);
    res.setHeader("Content-Type", cached.contentType);
    res.setHeader("X-Emoji-Type", cached.emojiType);
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    res.status(200).send(cached.buffer);
    return;
  }

  const botToken = (process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "").trim();
  if (!botToken) {
    res.status(500).json({ error: "Bot token not configured" });
    return;
  }

  try {
    // 1. Fetch custom emoji sticker metadata from Telegram
    const stickerRes = await fetch(`https://api.telegram.org/bot${botToken}/getCustomEmojiStickers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_emoji_ids: [emojiId] })
    });

    const stickerData = await stickerRes.json();
    if (!stickerData.ok || !stickerData.result || !stickerData.result[0]) {
      res.status(404).json({ error: "Custom emoji not found on Telegram" });
      return;
    }

    const sticker = stickerData.result[0];
    const fileId = sticker.file_id;

    // 2. Get file path
    const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();

    if (!fileData.ok || !fileData.result || !fileData.result.file_path) {
      res.status(404).json({ error: "Emoji file path not found" });
      return;
    }

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;

    // 3. Download the actual emoji asset (TGS / WebM / WebP / etc.)
    const dlRes = await fetch(downloadUrl);
    if (!dlRes.ok) {
      res.status(502).json({ error: "Failed to download emoji file from Telegram" });
      return;
    }

    const arrayBuf = await dlRes.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuf);

    let contentType = "image/webp";
    let emojiType = "image";
    let payloadBuffer = rawBuffer;

    if (filePath.endsWith(".tgs") || sticker.is_animated) {
      try {
        // TGS is a gzipped Lottie JSON. Decompress to raw JSON for seamless browser Lottie rendering!
        payloadBuffer = zlib.gunzipSync(rawBuffer);
        contentType = "application/json; charset=utf-8";
        emojiType = "lottie";
      } catch (gzErr) {
        contentType = "application/gzip";
        emojiType = "tgs";
      }
    } else if (filePath.endsWith(".webm") || sticker.is_video) {
      contentType = "video/webm";
      emojiType = "video";
    } else if (filePath.endsWith(".png")) {
      contentType = "image/png";
      emojiType = "image";
    }

    // Cache the result (max 100 items in memory)
    if (emojiCache.size < 100) {
      emojiCache.set(emojiId, { buffer: payloadBuffer, contentType, emojiType });
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("X-Emoji-Type", emojiType);
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    res.status(200).send(payloadBuffer);
  } catch (err) {
    console.error("api/emoji error:", err && err.message);
    res.status(500).json({ error: "Server error fetching emoji" });
  }
});
