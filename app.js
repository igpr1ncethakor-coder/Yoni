(() => {
  "use strict";

  // IMPORTANT: Set this to your deployed backend's HTTPS base URL, with no trailing slash.
  // Example: const API_BASE = "https://your-yoni-backend.example.com";
  const API_BASE = "https://YOUR-BACKEND-URL";
  const BOT_USERNAME = "Yonimargbot";
  const BOT_LINK = `https://t.me/${BOT_USERNAME}`;
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  const $ = id => document.getElementById(id);
  const state = { videos: [], category: "All", query: "", page: "homePage", saved: new Set(readSaved()) };

  function readSaved() {
    try { return JSON.parse(localStorage.getItem("yoni_saved_codes") || "[]"); } catch (_) { return []; }
  }
  function saveSaved() {
    try { localStorage.setItem("yoni_saved_codes", JSON.stringify([...state.saved])); } catch (_) {}
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function normalizeVideo(v, index) {
    const code = String(v.code || v.id || `VIDEO-${index + 1}`);
    return {
      ...v,
      code,
      title: String(v.title || `Video ${code}`),
      description: String(v.description || ""),
      category: String(v.category || "All"),
      badge: String(v.badge || (Number(v.priceStars || v.price || 0) > 0 ? "PREMIUM" : "NEW")),
      views: Number(v.views || v.appViews || 0),
      duration: String(v.duration || ""),
      price: Number(v.priceStars ?? v.price ?? 0),
      thumbnail: String(v.thumbnailUrl || v.thumbnail || v.image || "")
    };
  }
  function videoLink(video) {
    // The current backend supports /start V001 deep links. Telegram requires users to start the bot once.
    return `${BOT_LINK}?start=${encodeURIComponent(video.code)}`;
  }
  function openLink(url) {
    if (tg && typeof tg.openTelegramLink === "function" && url.startsWith("https://t.me/")) tg.openTelegramLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }
  function notify(message) {
    if (tg && typeof tg.showAlert === "function") tg.showAlert(message);
    else window.alert(message);
  }
  function setNotice(message) {
    const box = $("connectionNotice");
    box.textContent = message;
    box.classList.add("show");
  }
  function clearNotice() { $("connectionNotice").classList.remove("show"); }

  async function loadVideos() {
    $("catalogStatus").textContent = "Connecting…";
    if (!API_BASE || API_BASE.includes("YOUR-BACKEND-URL")) {
      state.videos = [];
      $("catalogStatus").textContent = "Setup needed";
      setNotice("The frontend is ready, but the backend address has not been configured yet. Set API_BASE in this file to your deployed backend HTTPS URL.");
      render();
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/videos`, { headers: { "Accept": "application/json" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      const items = Array.isArray(data) ? data : (Array.isArray(data.videos) ? data.videos : []);
      state.videos = items.map(normalizeVideo);
      $("catalogStatus").textContent = "Live catalogue";
      clearNotice();
      render();
    } catch (err) {
      $("catalogStatus").textContent = "Offline";
      setNotice("Could not load videos from the backend. Check the backend URL, server status and CORS settings. " + err.message);
      render();
    }
  }

  function filteredVideos() {
    let items = state.videos.filter(v => state.category === "All" || v.category.toLowerCase() === state.category.toLowerCase());
    if (state.query) {
      const q = state.query.toLowerCase();
      items = items.filter(v => `${v.title} ${v.description} ${v.category} ${v.code}`.toLowerCase().includes(q));
    }
    if (state.page === "savedPage") items = items.filter(v => state.saved.has(v.code));
    if (state.category === "Trending") items = [...items].sort((a,b) => b.views - a.views);
    return items;
  }
  function renderCategories() {
    const categories = ["All", ...new Set(state.videos.map(v => v.category).filter(c => c && c.toLowerCase() !== "all"))];
    if (!categories.includes("Trending")) categories.splice(1, 0, "Trending");
    $("categoryChips").innerHTML = categories.map(c => `<button class="chip ${state.category === c ? "active" : ""}" data-category="${escapeHTML(c)}">${escapeHTML(c)}</button>`).join("");
  }
  function cardHTML(v) {
    const isSaved = state.saved.has(v.code);
    const thumb = v.thumbnail
      ? `<img src="${escapeHTML(v.thumbnail)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.insertAdjacentHTML('afterbegin','<span class=&quot;placeholder&quot;>▶</span>')">`
      : `<span class="placeholder">▶</span>`;
    return `<article class="card">
      <div class="thumb">${thumb}<span class="badge">${escapeHTML(v.badge)}</span>${v.duration ? `<span class="duration">${escapeHTML(v.duration)}</span>` : ""}</div>
      <div class="card-body"><h3 title="${escapeHTML(v.title)}">${escapeHTML(v.title)}</h3>
      <div class="meta"><span>${escapeHTML(v.category)}</span><span>•</span><span>${v.views.toLocaleString()} views</span></div>
      <div class="card-actions"><button class="primary" data-watch="${escapeHTML(v.code)}">${v.price > 0 ? `⭐ ${v.price} Stars` : "▶ Watch"}</button><button class="secondary" data-save="${escapeHTML(v.code)}" aria-label="${isSaved ? "Remove saved video" : "Save video"}">${isSaved ? "♥" : "♡"}</button></div></div></article>`;
  }
  function renderGrid(target, items, emptyTitle, emptyText) {
    $(target).innerHTML = items.length ? items.map(cardHTML).join("") : `<div class="empty"><b>${escapeHTML(emptyTitle)}</b>${escapeHTML(emptyText)}</div>`;
  }
  function render() {
    renderCategories();
    const videos = filteredVideos();
    $("feedTitle").textContent = state.category === "All" ? "Videos for you" : state.category === "Trending" ? "Trending for you" : state.category;
    $("videoCount").textContent = `${videos.length} video${videos.length === 1 ? "" : "s"}`;
    renderGrid("videoGrid", videos, "No videos found", state.videos.length ? "Try another search or category." : "Once the backend is connected and videos are registered, they will appear here.");
    renderGrid("savedGrid", state.videos.filter(v => state.saved.has(v.code)), "Nothing saved yet", "Tap the ♡ button on a video to save it on this device.");
  }
  function switchPage(page) {
    state.page = page;
    document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === page));
    document.querySelectorAll(".nav button").forEach(el => el.classList.toggle("active", el.dataset.page === page));
    if (page === "savedPage") render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.addEventListener("click", event => {
    const category = event.target.closest("[data-category]");
    const watch = event.target.closest("[data-watch]");
    const save = event.target.closest("[data-save]");
    const nav = event.target.closest("[data-page]");
    if (category) {
      state.category = category.dataset.category;
      state.page = "homePage";
      switchPage("homePage");
      render();
    }
    if (watch) {
      const video = state.videos.find(v => v.code === watch.dataset.watch);
      if (video) openLink(videoLink(video));
    }
    if (save) {
      const code = save.dataset.save;
      if (state.saved.has(code)) state.saved.delete(code); else state.saved.add(code);
      saveSaved();
      render();
    }
    if (nav) switchPage(nav.dataset.page);
  });
  $("searchInput").addEventListener("input", event => { state.query = event.target.value.trim(); render(); });
  $("refreshButton").addEventListener("click", loadVideos);
  $("aboutButton").addEventListener("click", () => notify("Yoni is a Telegram Mini App. Video delivery, paid access and referral rewards depend on the connected Telegram bot and backend."));
  function inviteLink() {
    const userId = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : "";
    return `${BOT_LINK}?start=${userId ? `ref_${userId}` : "invite"}`;
  }
  async function shareInvite() {
    const link = inviteLink();
    const text = `Check out Yoni: ${link}`;
    if (tg && typeof tg.switchInlineQuery === "function") {
      try { await navigator.clipboard.writeText(text); notify("Invite link copied. Share it with friends."); return; } catch (_) {}
    }
    if (navigator.share) {
      try { await navigator.share({ title: "Yoni", text: "Check out Yoni", url: link }); return; } catch (_) {}
    }
    try { await navigator.clipboard.writeText(link); notify("Invite link copied."); }
    catch (_) { notify(link); }
  }
  $("shareButton").addEventListener("click", shareInvite);
  $("profileShare").addEventListener("click", shareInvite);
  $("copyInvite").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(inviteLink()); notify("Invite link copied."); }
    catch (_) { notify(inviteLink()); }
  });

  if (tg) {
    tg.ready();
    tg.expand();
    const user = tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (user) {
      $("profileName").textContent = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Yoni viewer";
      $("profileHint").textContent = user.username ? `@${user.username}` : "Signed in through Telegram.";
    }
  }
  loadVideos();
})();