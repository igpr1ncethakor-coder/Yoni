
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!BOT_TOKEN || !ADMIN_ID) {
    console.error("BOT_TOKEN and ADMIN_ID are required.");
    process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, {
    polling: true
});

const videos = [];
const userStates = {};

app.get("/", (req, res) => {
    res.json({
        status: "online",
        service: "Yoni Backend"
    });
});

// Public catalog: never expose private Telegram file IDs.
app.get("/api/videos", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(videos.map(video => ({
        id: video.id,
        title: video.title,
        description: video.description,
        unlock: video.unlock,
        thumbnailUrl: video.thumbnailFileId
            ? `/api/videos/${encodeURIComponent(video.id)}/thumbnail`
            : null
    })));
});

// Return the thumbnail without revealing the bot token.
app.get("/api/videos/:id/thumbnail", async (req, res) => {
    const video = videos.find(v => v.id === req.params.id);

    if (!video || !video.thumbnailFileId) {
        return res.status(404).json({
            error: "Thumbnail not found"
        });
    }

    try {
        const url = await bot.getFileLink(video.thumbnailFileId);
        const response = await fetch(url);

        if (!response.ok) {
            return res.status(502).json({
                error: "Thumbnail unavailable"
            });
        }

        res.set("Content-Type", "image/jpeg");
        res.set("Cache-Control", "public, max-age=300");
        res.send(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
        console.error("Thumbnail error:", error.message);
        res.status(502).json({
            error: "Could not load thumbnail"
        });
    }
});

function isAdmin(msg) {
    return msg.from &&
        String(msg.from.id) === String(ADMIN_ID);
}

bot.onText(/^\/start$/, async msg => {
    if (!isAdmin(msg)) {
        return bot.sendMessage(
            msg.chat.id,
            "Yoni content bot is private."
        );
    }

    bot.sendMessage(
        msg.chat.id,
        "👑 Yoni Admin Panel\n\n" +
        "Send /addvideo to publish a video.\n" +
        "Send /cancel to cancel."
    );
});

bot.onText(/^\/cancel$/, msg => {
    if (!isAdmin(msg)) return;

    delete userStates[msg.from.id];

    bot.sendMessage(msg.chat.id, "Cancelled.");
});

bot.onText(/^\/addvideo$/, msg => {
    if (!isAdmin(msg)) return;

    userStates[msg.from.id] = {
        step: "waiting_video"
    };

    bot.sendMessage(
        msg.chat.id,
        "🎬 Send a video, or forward a video from your private channel."
    );
});

bot.on("video", async msg => {
    if (!isAdmin(msg)) return;

    const state = userStates[msg.from.id];

    if (!state || state.step !== "waiting_video") return;

    state.videoFileId = msg.video.file_id;
    state.step = "waiting_title";

    await bot.sendMessage(
        msg.chat.id,
        "✅ Video received.\n\nSend the title."
    );
});

bot.on("photo", async msg => {
    if (!isAdmin(msg)) return;

    const state = userStates[msg.from.id];

    if (!state || state.step !== "waiting_thumbnail") return;

    const photos = msg.photo || [];
    if (!photos.length) return;

    state.thumbnailFileId =
        photos[photos.length - 1].file_id;

    state.step = "waiting_unlock";

    await bot.sendMessage(
        msg.chat.id,
        "🖼️ Thumbnail received!\n\n" +
        "Choose unlock method:\nFREE\nREFERRALS\nSTARS"
    );
});

bot.on("message", async msg => {
    if (!isAdmin(msg) || !msg.text) return;

    const text = msg.text.trim();
    const state = userStates[msg.from.id];

    if (!state) return;

    if (text.startsWith("/") &&
        !(state.step === "waiting_thumbnail" &&
          text.toLowerCase() === "/skip")) {
        return;
    }

    if (state.step === "waiting_title") {
        state.title = text.slice(0, 200);
        state.step = "waiting_description";

        return bot.sendMessage(
            msg.chat.id,
            "📝 Send a description."
        );
    }

    if (state.step === "waiting_description") {
        state.description = text.slice(0, 1000);
        state.step = "waiting_thumbnail";

        return bot.sendMessage(
            msg.chat.id,
            "🖼️ Send a thumbnail photo, or /skip."
        );
    }

    if (state.step === "waiting_thumbnail" &&
        text.toLowerCase() === "/skip") {
        state.thumbnailFileId = null;
        state.step = "waiting_unlock";

        return bot.sendMessage(
            msg.chat.id,
            "Choose unlock method:\nFREE\nREFERRALS\nSTARS"
        );
    }

    if (state.step === "waiting_unlock") {
        const choice = text.toUpperCase();

        if (choice === "FREE") {
            publishVideo(msg.chat.id, state, {
                type: "free"
            });
            delete userStates[msg.from.id];
            return;
        }

        if (choice === "REFERRALS") {
            state.step = "waiting_referrals";

            return bot.sendMessage(
                msg.chat.id,
                "🔗 How many successful referrals are required?"
            );
        }

        if (choice === "STARS") {
            state.step = "waiting_price";

            return bot.sendMessage(
                msg.chat.id,
                "⭐ Enter a whole-number Stars price."
            );
        }

        return bot.sendMessage(
            msg.chat.id,
            "Send FREE, REFERRALS, or STARS."
        );
    }

    if (state.step === "waiting_price") {
        const price = Number(text);

        if (!Number.isSafeInteger(price) || price <= 0) {
            return bot.sendMessage(
                msg.chat.id,
                "Enter a positive whole-number price."
            );
        }

        publishVideo(msg.chat.id, state, {
            type: "stars",
            price
        });

        delete userStates[msg.from.id];
        return;
    }

    if (state.step === "waiting_referrals") {
        const required = Number(text);

        if (!Number.isSafeInteger(required) || required < 1) {
            return bot.sendMessage(
                msg.chat.id,
                "Enter a positive referral count."
            );
        }

        publishVideo(msg.chat.id, state, {
            type: "referrals",
            required
        });

        delete userStates[msg.from.id];
    }
});

function publishVideo(chatId, state, unlock) {
    const video = {
        id: Date.now().toString(),
        telegramFileId: state.videoFileId,
        thumbnailFileId: state.thumbnailFileId || null,
        title: state.title,
        description: state.description,
        unlock,
        createdAt: new Date().toISOString()
    };

    videos.unshift(video);

    let unlockText = "🆓 FREE";

    if (unlock.type === "referrals") {
        unlockText = `🔗 ${unlock.required} referrals`;
    }

    if (unlock.type === "stars") {
        unlockText = `⭐ ${unlock.price} Stars`;
    }

    bot.sendMessage(
        chatId,
        "✅ VIDEO ADDED TO YONI CATALOG\n\n" +
        `🎬 ${video.title}\n` +
        `🔐 ${unlockText}\n\n` +
        "Note: the catalog resets when the server restarts. " +
        "Secure Watch delivery is not connected yet."
    );
}

app.listen(PORT, () => {
    console.log(`Yoni backend running on port ${PORT}`);
});
