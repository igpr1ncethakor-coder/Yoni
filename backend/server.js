
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID || "");
const CHANNEL_ID = String(process.env.CHANNEL_ID || "");

if (!BOT_TOKEN) {
  console.error("Missing BOT_TOKEN environment variable");
  process.exit(1);
}

const PORT = process.env.PORT || 10000;

// Render's temporary filesystem is writable, but not permanent.
const DATA_DIR = process.env.DATA_DIR || "/tmp/yoni";
const DATA_FILE = path.join(DATA_DIR, "videos.json");

let videos = [];
let nextNumber = 1;
const userStates = {};

function loadCatalog() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    if (fs.existsSync(DATA_FILE)) {
      const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      videos = Array.isArray(saved.videos) ? saved.videos : [];
      nextNumber = Number(saved.nextNumber) || videos.length + 1;
    }

    console.log(`Catalog loaded: ${videos.length} videos`);
  } catch (err) {
    console.error("Catalog load error:", err.message);
  }
}

function saveCatalog() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ videos, nextNumber }, null, 2)
    );
    return true;
  } catch (err) {
    console.error("Catalog save error:", err.message);
    return false;
  }
}

function makeCode() {
  const code = `V${String(nextNumber).padStart(3, "0")}`;
  nextNumber++;
  return code;
}

function publicVideo(video) {
  const { telegramFileId, ...safeVideo } = video;
  return safeVideo;
}

loadCatalog();

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

app.get("/", (req, res) => {
  res.send("Yoni backend is running");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    videos: videos.length,
    channelConfigured: Boolean(CHANNEL_ID)
  });
});

app.get("/api/videos", (req, res) => {
  res.json(videos.map(publicVideo));
});

app.get("/api/videos/:code", (req, res) => {
  const video = videos.find(
    item => item.code.toLowerCase() === req.params.code.toLowerCase()
  );

  if (!video) {
    return res.status(404).json({ error: "Video not found" });
  }

  res.json(publicVideo(video));
});

// Bot deep link: https://t.me/Yonimargbot?start=V001
// The viewer must have started/interacted with the bot before
// Telegram will allow private bot messages.
bot.onText(/^\/start(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const payload = (match && match[1] ? match[1] : "").trim();

  if (payload && /^V\d+$/i.test(payload)) {
    const video = videos.find(
      item => item.code.toLowerCase() === payload.toLowerCase()
    );

    if (!video || !video.telegramFileId) {
      await bot.sendMessage(chatId, "Sorry, this video is not available yet.");
      return;
    }

    try {
      await bot.sendVideo(chatId, video.telegramFileId, {
        caption: `${video.title || video.code}\n\n${video.description || ""}`
      });

      console.log(`Delivered ${video.code} to user ${chatId}`);
    } catch (err) {
      console.error("Video delivery failed:", err.message);
      await bot.sendMessage(
        chatId,
        "Sorry, I couldn't send this video. Please try again later."
      );
    }

    return;
  }

  await bot.sendMessage(
    chatId,
    "Welcome to Yoni! Open the Mini App and select a video to receive it here."
  );
});

// Register NEW videos posted directly in the configured channel.
bot.on("channel_post", msg => {
  try {
    const actualChannel = String(msg.chat.id);

    if (CHANNEL_ID && actualChannel !== CHANNEL_ID) {
      return;
    }

    const media = msg.video || msg.document;

    if (!media) {
      return;
    }

    // Prevent duplicate registration of the same channel post.
    const alreadySaved = videos.some(
      item =>
        String(item.channelId) === actualChannel &&
        item.messageId === msg.message_id
    );

    if (alreadySaved) {
      return;
    }

    const code = makeCode();

    const video = {
      code,
      title: msg.caption || `Video ${code}`,
      description: "",
      category: "All",
      unlock: "FREE",
      priceStars: 0,
      channelId: actualChannel,
      messageId: msg.message_id,
      telegramFileId: media.file_id,
      duration: msg.video ? msg.video.duration || 0 : 0,
      telegramViews:
        Number.isFinite(msg.views) ? msg.views : null,
      appViews: 0,
      createdAt: new Date().toISOString()
    };

    videos.push(video);

    if (saveCatalog()) {
      console.log(`Registered channel video: ${code}`);
    }
  } catch (err) {
    console.error("Channel video registration failed:", err.message);
  }
});

bot.on("polling_error", err => {
  console.error("Telegram polling error:", err.message);
});

bot.on("webhook_error", err => {
  console.error("Telegram webhook error:", err.message);
});

// Admin command to inspect registered video codes.
bot.onText(/^\/videos$/, async msg => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  if (!videos.length) {
    await bot.sendMessage(msg.chat.id, "No videos registered yet.");
    return;
  }

  const list = videos
    .slice(-50)
    .map(v => `${v.code} — ${v.title}`)
    .join("\n");

  await bot.sendMessage(msg.chat.id, list);
});

// Admin command to edit a title: /edit V001
bot.onText(/^\/edit\s+(V\d+)$/i, async (msg, match) => {
  if (String(msg.from.id) !== ADMIN_ID) return;

  const video = videos.find(
    item => item.code.toLowerCase() === match[1].toLowerCase()
  );

  if (!video) {
    await bot.sendMessage(msg.chat.id, "Video code not found.");
    return;
  }

  userStates[msg.from.id] = { code: video.code };

  await bot.sendMessage(
    msg.chat.id,
    `Current title: ${video.title}\nSend the new title, or /cancel.`
  );
});

bot.onText(/^\/cancel$/, async msg => {
  if (String(msg.from.id) !== ADMIN_ID) return;
  delete userStates[msg.from.id];
  await bot.sendMessage(msg.chat.id, "Cancelled.");
});

bot.on("message", async msg => {
  if (!msg.text || !msg.from) return;
  if (String(msg.from.id) !== ADMIN_ID) return;
  if (/^\/(start|videos|edit|cancel)\b/i.test(msg.text)) return;

  const state = userStates[msg.from.id];
  if (!state) return;

  const video = videos.find(item => item.code === state.code);
  if (!video) {
    delete userStates[msg.from.id];
    return;
  }

  video.title = msg.text.trim();
  saveCatalog();
  delete userStates[msg.from.id];

  await bot.sendMessage(msg.chat.id, `Updated ${video.code} title.`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Yoni backend running on port ${PORT}`);
});
