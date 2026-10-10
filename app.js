
const videos = [
  {
    id: 1,
    title: "Featured Video",
    category: "Chinese",
    views: 98,
    duration: "5:36",
    badge: "NEW",
    price: 0
  },
  {
    id: 2,
    title: "Drama Collection",
    category: "Drama",
    views: 156,
    duration: "8:21",
    badge: "PREMIUM",
    price: 50
  },
  {
    id: 3,
    title: "Premium Video",
    category: "Premium",
    views: 75,
    duration: "6:12",
    badge: "PREMIUM",
    price: 25
  },
  {
    id: 4,
    title: "Trending Video",
    category: "Chinese",
    views: 240,
    duration: "4:45",
    badge: "TRENDING",
    price: 0
  }
];

const categories = [
  "All", "Trending", "New", "Chinese", "Drama", "Premium"
];

const collections = [
  { title: "🇨🇳 Chinese", category: "Chinese" },
  { title: "🎭 Drama", category: "Drama" },
  { title: "⭐ Premium", category: "Premium" },
  { title: "🔥 Trending", category: "Trending" },
  { title: "🆕 New", category: "New" }
];

const likedVideos = new Set();
let currentCategory = "All";
let currentPage = "home";
let searchTerm = "";

const $ = id => document.getElementById(id);

function safe(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function renderCategories() {
  const box = $("categories");
  if (!box) return;

  box.innerHTML = categories.map(category => `
    <button class="category-chip ${
      currentCategory === category ? "active" : ""
    }" data-category="${safe(category)}">
      ${safe(category)}
    </button>
  `).join("");
}

function renderCollections() {
  const box = $("collections");
  if (!box) return;

  box.innerHTML = collections.map(item => `
    <button class="collection-card"
      data-collection="${safe(item.category)}">
      <div class="collection-image">
        <span>🖼️</span>
      </div>
      <span class="collection-name">${safe(item.title)}</span>
    </button>
  `).join("");
}

function getVideos() {
  let result = [...videos];

  if (searchTerm) {
    result = result.filter(video =>
      video.title.toLowerCase().includes(searchTerm) ||
      video.category.toLowerCase().includes(searchTerm)
    );
  }

  if (currentPage === "liked") {
    result = result.filter(video => likedVideos.has(video.id));
  } else if (currentPage === "trending" ||
             currentCategory === "Trending") {
    result.sort((a, b) => b.views - a.views);
  } else if (currentPage === "profile") {
    return [];
  } else if (currentCategory === "New") {
    result = result.filter(video => video.badge === "NEW");
  } else if (currentCategory !== "All") {
    result = result.filter(video =>
      video.category === currentCategory
    );
  }

  return result;
}

function renderVideos() {
  const box = $("videoFeed");
  const empty = $("emptyMessage");
  if (!box) return;

  const list = getVideos();

  box.innerHTML = list.map(video => `
    <article class="content-card">
      <div class="video-thumbnail thumbnail-one">
        <span class="video-badge">${safe(video.badge)}</span>
        <button class="play-button"
          data-play="${video.id}" aria-label="Play video">▶</button>
        <span class="video-duration">${safe(video.duration)}</span>
      </div>

      <div class="content-info">
        <h3>${safe(video.title)}</h3>
        <p>${safe(video.category)}</p>

        <div class="stats">
          <span>👁 ${video.views} views</span>
          <span>${safe(video.duration)}</span>
        </div>

        <div class="video-actions">
          <button class="video-action"
            data-like="${video.id}">
            ${likedVideos.has(video.id) ? "❤️ Saved" : "♡ Save"}
          </button>

          <button class="video-action"
            data-open="${video.id}">
            ${video.price > 0
              ? `⭐ ${video.price} Stars`
              : "▶ Watch"}
          </button>
        </div>
      </div>
    </article>
  `).join("");

  if (empty) empty.hidden = list.length > 0;

  const title = $("feedTitle");
  if (title) {
    title.textContent = currentPage === "liked"
      ? "Saved videos"
      : currentPage === "profile"
      ? "Profile"
      : currentPage === "trending" ||
        currentCategory === "Trending"
      ? "Trending for you"
      : currentCategory === "All"
      ? "Videos for you"
      : currentCategory;
  }
}

function render() {
  renderCategories();
  renderCollections();
  renderVideos();
}

document.addEventListener("click", event => {
  const categoryButton = event.target.closest("[data-category]");
  const collectionButton = event.target.closest("[data-collection]");
  const likeButton = event.target.closest("[data-like]");
  const playButton = event.target.closest("[data-play]");
  const openButton = event.target.closest("[data-open]");
  const navButton = event.target.closest("[data-page]");

  if (categoryButton) {
    currentCategory = categoryButton.dataset.category;
    currentPage = "home";
    render();
  }

  if (collectionButton) {
    currentCategory = collectionButton.dataset.collection;
    currentPage = "home";
    render();
    $("feedTitle")?.scrollIntoView({ behavior: "smooth" });
  }

  if (likeButton) {
    const id = Number(likeButton.dataset.like);
    likedVideos.has(id)
      ? likedVideos.delete(id)
      : likedVideos.add(id);
    renderVideos();
  }

  if (playButton || openButton) {
    const id = Number(
      (playButton || openButton).dataset.play ??
      (playButton || openButton).dataset.open
    );
    const video = videos.find(item => item.id === id);

    if (video) {
      alert(video.price > 0
        ? `${video.title}: Stars payment is not connected yet.`
        : `${video.title}: Add your video delivery link to enable playback.`);
    }
  }

  if (navButton) {
    currentPage = navButton.dataset.page;
    currentCategory = "All";

    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle("active", button === navButton);
    });

    render();
  }
});

$("searchInput")?.addEventListener("input", event => {
  searchTerm = event.target.value.trim().toLowerCase();
  renderVideos();
});

$("searchButton")?.addEventListener("click", () => {
  searchTerm = ($("searchInput")?.value || "").trim().toLowerCase();
  renderVideos();
});

$("inviteButton")?.addEventListener("click", async () => {
  const shareData = {
    title: "Yoni",
    text: "Check out Yoni!"
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      alert("Connect your Telegram invite link here.");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      alert("Sharing is unavailable. Try again.");
    }
  }
});

$("seeAllButton")?.addEventListener("click", () => {
  currentCategory = "All";
  currentPage = "home";
  render();
});

render();
