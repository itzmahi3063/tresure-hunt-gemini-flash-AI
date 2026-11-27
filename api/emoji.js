const { withVpsFallback } = require("../lib/vpsBridge");

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

    // 3. Download the actual emoji asset (WebM / WebP / etc.)
    const dlRes = await fetch(downloadUrl);
    if (!dlRes.ok) {
      res.status(502).json({ error: "Failed to download emoji file from Telegram" });
      return;
    }

    const arrayBuf = await dlRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    let contentType = "image/webp";
    if (filePath.endsWith(".webm")) {
      contentType = "video/webm";
    } else if (filePath.endsWith(".tgs")) {
      contentType = "application/gzip";
    } else if (filePath.endsWith(".png")) {
      contentType = "image/png";
    }

    // Cache the result (max 100 items to avoid excessive memory)
    if (emojiCache.size < 100) {
      emojiCache.set(emojiId, { buffer, contentType });
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    res.status(200).send(buffer);
  } catch (err) {
    console.error("api/emoji error:", err && err.message);
    res.status(500).json({ error: "Server error fetching emoji" });
  }
});
