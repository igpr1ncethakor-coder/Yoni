
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const DATA_DIR = process.env.DATA_DIR || "/data";
const DATA_FILE = path.join(DATA_DIR, "yoni-videos.json");

if (!BOT_TOKEN || !ADMIN_ID) {
  console.error("BOT_TOKEN and ADMIN_ID are required.");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
let videos = [];
let nextNumber = 1;
const states = {};

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    videos = Array.isArray(saved.videos) ? saved.videos : [];
    nextNumber = Number(saved.nextNumber) || videos.length + 1;
  }
} catch (e) {
  console.error("Catalog load error:", e.message);
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = DATA_FILE + ".tmp";
    fs.writeFileSync(temp, JSON.stringify({ videos, nextNumber }, null, 2));
    fs.renameSync(temp, DATA_FILE);
  } catch (e) {
    console.error("Catalog save error:", e.message);
    throw e;
  }
}

function admin(msg) {
  return msg.from && String(msg.from.id) === String(ADMIN_ID);
}

function publicVideo(v) {
  return {
    id: v.id,
    code: v.code,
    title: v.title,
    description: v.description,
    category: v.category,
    thumbnailUrl: v.thumbnailFileId
      ? `/api/videos/${encodeURIComponent(v.id)}/thumbnail`
      : null,
    duration: v.duration || "",
    unlock: v.unlock || { type: "free" },
    telegramViews: v.telegramViews ?? null,
    appViews: Number(v.appViews) || 0,
    createdAt: v.createdAt
  };
}

app.get("/", (req, res) => {
  res.json({ status: "online", service: "Yoni Backend" });
});

app.get("/api/videos", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(videos.filter(v => !v.deleted).map(publicVideo));
});

app.get("/api/videos/:id/thumbnail", async (req, res) => {
  const v = videos.find(x => x.id === req.params.id && !x.deleted);
  if (!v || !v.thumbnailFileId) {
    return res.status(404).json({ error: "Thumbnail not found" });
  }

  try {
    const url = await bot.getFileLink(v.thumbnailFileId);
    const r = await fetch(url);
    if (!r.ok) throw new Error("Telegram image fetch failed");
    res.set("Content-Type", "image/jpeg");
    res.set("Cache-Control", "public, max-age=300");
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    console.error("Thumbnail error:", e.message);
    res.status(502).json({ error: "Thumbnail unavailable" });
  }
});

// Admin bot: /start, /addvideo, /edit V001
bot.onText(/^\/start(?:@\w+)?$/, msg => {
  if (!admin(msg)) return bot.sendMessage(msg.chat.id, "Yoni content bot is private.");
  bot.sendMessage(
    msg.chat.id,
    "👑 Yoni Admin\n\n" +
    "/addvideo — register a channel video\n" +
    "/edit V001 — edit video metadata\n" +
    "/cancel — cancel current action"
  );
});

bot.onText(/^\/cancel(?:@\w+)?$/, msg => {
  if (!admin(msg)) return;
  delete states[msg.from.id];
  bot.sendMessage(msg.chat.id, "Cancelled.");
});

bot.onText(/^\/addvideo(?:@\w+)?$/, msg => {
  if (!admin(msg)) return;
  states[msg.from.id] = { step: "video" };
  bot.sendMessage(
    msg.chat.id,
    "Forward a video post from your private channel now.\n" +
    "The bot must have access to the channel."
  );
});

bot.onText(/^\/edit(?:@\w+)?\s+(V\d+)$/i, (msg, match) => {
  if (!admin(msg)) return;
  const v = videos.find(x => x.code === match[1].toUpperCase() && !x.deleted);
  if (!v) return bot.sendMessage(msg.chat.id, "Video code not found.");
  states[msg.from.id] = { step: "editTitle", videoId: v.id };
  bot.sendMessage(
    msg.chat.id,
    `Editing ${v.code}\nCurrent title: ${v.title}\nSend new title, or /cancel.`
  );
});

bot.on("channel_post", msg => {
  if (CHANNEL_ID && String(msg.chat.id) !== String(CHANNEL_ID)) return;
  const media = msg.video || msg.document;
  if (!media || (msg.document && !String(media.mime_type || "").startsWith("video/"))) return;

  // Avoid duplicate records for the same channel post.
  if (videos.some(v =>
    String(v.channelId) === String(msg.chat.id) &&
    Number(v.messageId) === Number(msg.message_id)
  )) return;

  const code = "V" + String(nextNumber++).padStart(3, "0");
  const v = {
    id: `${msg.chat.id}_${msg.message_id}`,
    code,
    channelId: msg.chat.id,
    messageId: msg.message_id,
    telegramFileId: media.file_id,
    thumbnailFileId: msg.video?.thumbnail?.file_id || null,
    title: `Video ${code}`,
    description: "",
    category: "All",
    duration: msg.video?.duration ? `${msg.video.duration}s` : "",
    unlock: { type: "free" },
    telegramViews: Number.isFinite(msg.views) ? msg.views : null,
    appViews: 0,
    createdAt: new Date().toISOString(),
    deleted: false
  };

  videos.unshift(v);
  try {
    save();
    console.log("Registered channel video:", code);
  } catch (e) {
    videos = videos.filter(x => x.id !== v.id);
    nextNumber--;
  }
});

bot.on("message", async msg => {
  if (!admin(msg) || !msg.text) return;
  const state = states[msg.from.id];
  if (!state) return;

  if (msg.text.startsWith("/")) return;

  if (state.step === "editTitle") {
    const v = videos.find(x => x.id === state.videoId);
    if (!v) {
      delete states[msg.from.id];
      return bot.sendMessage(msg.chat.id, "Video no longer exists.");
    }
    v.title = msg.text.trim().slice(0, 200);
    save();
    delete states[msg.from.id];
    return bot.sendMessage(
      msg.chat.id,
      `Saved ${v.code}: ${v.title}\n\n` +
      "Use the Yoni editor to update its thumbnail, description and category."
    );
  }

  if (state.step === "video") {
    return bot.sendMessage(
      msg.chat.id,
      "Please forward a video post from the channel. " +
      "The bot registers channel posts automatically when it receives them."
    );
  }
});

bot.on("polling_error", e => console.error("Telegram polling error:", e.message));

app.listen(PORT, () => {
  console.log(`Yoni backend running on port ${PORT}`);
});
