const express = require("express");
const TelegramBot = require("node-telegram-bot-api");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is missing.");
    process.exit(1);
}

if (!ADMIN_ID) {
    console.error("ADMIN_ID is missing.");
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

app.get("/api/videos", (req, res) => {
    res.json(videos);
});

function isAdmin(msg) {
    return String(msg.from.id) === String(ADMIN_ID);
}

bot.onText(/^\/start$/, async (msg) => {

    if (!isAdmin(msg)) {
        await bot.sendMessage(
            msg.chat.id,
            "Yoni content bot is private."
        );
        return;
    }

    await bot.sendMessage(
        msg.chat.id,
        "👑 Yoni Admin Panel\n\n" +
        "Send /addvideo to publish a new video."
    );
});

bot.onText(/^\/addvideo$/, async (msg) => {

    if (!isAdmin(msg)) return;

    userStates[msg.from.id] = {
        step: "waiting_video"
    };

    await bot.sendMessage(
        msg.chat.id,
        "🎬 Send me the video you want to publish."
    );
});

bot.on("video", async (msg) => {

    if (!isAdmin(msg)) return;

    const state = userStates[msg.from.id];

    if (!state || state.step !== "waiting_video") {
        return;
    }

    state.videoFileId = msg.video.file_id;
    state.step = "waiting_title";

    await bot.sendMessage(
        msg.chat.id,
        "✅ Video received.\n\n" +
        "Now send the video title."
    );
});

bot.on("message", async (msg) => {

    if (!isAdmin(msg)) return;

    if (!msg.text) return;

    if (
        msg.text.startsWith("/") ||
        msg.text === "FREE" ||
        msg.text === "REFERRALS" ||
        msg.text === "STARS"
    ) {
        return;
    }

    const state = userStates[msg.from.id];

    if (!state) return;

    if (state.step === "waiting_title") {

        state.title = msg.text;
        state.step = "waiting_description";

        await bot.sendMessage(
            msg.chat.id,
            "📝 Send a description for this video."
        );

        return;
    }

    if (state.step === "waiting_description") {

        state.description = msg.text;
        state.step = "waiting_unlock";

        await bot.sendMessage(
            msg.chat.id,
            "🔐 Choose the unlock method:\n\n" +
            "Send exactly one of these:\n\n" +
            "FREE\n" +
            "REFERRALS\n" +
            "STARS"
        );

        return;
    }

    if (state.step === "waiting_price") {

        const price = Number(msg.text);

        if (!Number.isInteger(price) || price <= 0) {

            await bot.sendMessage(
                msg.chat.id,
                "❌ Please enter a valid whole-number Stars price."
            );

            return;
        }

        publishVideo(msg.chat.id, state, {
            type: "stars",
            price: price
        });

        delete userStates[msg.from.id];

        return;
    }

    if (state.step === "waiting_referrals") {

        const referrals = Number(msg.text);

        if (
            !Number.isInteger(referrals) ||
            referrals < 1
        ) {

            await bot.sendMessage(
                msg.chat.id,
                "❌ Enter a valid referral number."
            );

            return;
        }

        publishVideo(msg.chat.id, state, {
            type: "referrals",
            required: referrals
        });

        delete userStates[msg.from.id];

        return;
    }
});

bot.on("message", async (msg) => {

    if (!isAdmin(msg)) return;

    const state = userStates[msg.from.id];

    if (!state || !msg.text) return;

    if (state.step !== "waiting_unlock") {
        return;
    }

    const choice = msg.text.toUpperCase();

    if (choice === "FREE") {

        publishVideo(msg.chat.id, state, {
            type: "free"
        });

        delete userStates[msg.from.id];

        return;
    }

    if (choice === "REFERRALS") {

        state.step = "waiting_referrals";

        await bot.sendMessage(
            msg.chat.id,
            "🔗 How many successful referrals are required?\n\n" +
            "Example: 3"
        );

        return;
    }

    if (choice === "STARS") {

        state.step = "waiting_price";

        await bot.sendMessage(
            msg.chat.id,
            "⭐ Enter the Stars price.\n\n" +
            "Example: 10, 16, 22, 50"
        );

        return;
    }

    await bot.sendMessage(
        msg.chat.id,
        "❌ Please send FREE, REFERRALS, or STARS."
    );
});

function publishVideo(chatId, state, unlock) {

    const video = {
        id: Date.now().toString(),
        telegramFileId: state.videoFileId,
        title: state.title,
        description: state.description,
        unlock: unlock,
        createdAt: new Date().toISOString()
    };

    videos.push(video);

    let unlockText = "🆓 FREE";

    if (unlock.type === "referrals") {
        unlockText =
            "🔗 " +
            unlock.required +
            " referrals";
    }

    if (unlock.type === "stars") {
        unlockText =
            "⭐ " +
            unlock.price +
            " Stars";
    }

    bot.sendMessage(
        chatId,
        "✅ VIDEO PUBLISHED\n\n" +
        "🎬 " + video.title + "\n" +
        "🔐 " + unlockText + "\n\n" +
        "The video is now available to the Yoni app."
    );
}

app.listen(PORT, () => {

    console.log(
        `Yoni backend running on port ${PORT}`
    );

});
