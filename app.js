document.addEventListener("DOMContentLoaded", function () {

    let shareCount = 0;
    const requiredShares = 3;

    const inviteButton =
        document.getElementById("inviteButton");

    if (inviteButton) {
        inviteButton.addEventListener("click", function () {
            shareApp();
        });
    }


    /* SHARE UNLOCK */

    const unlockButton =
        document.querySelector(".unlock-button");

    if (unlockButton) {

        unlockButton.addEventListener("click", function () {

            if (shareCount >= requiredShares) {

                openVideo();

                return;
            }

            shareCount++;

            updateUnlock();

            shareApp();

        });
    }


    function updateUnlock() {

        const counter =
            document.querySelector(".unlock-count");

        const button =
            document.querySelector(".unlock-button");

        if (counter) {
            counter.textContent =
                shareCount + "/" + requiredShares;
        }

        if (button) {

            if (shareCount >= requiredShares) {

                button.textContent =
                    "🔓 WATCH NOW";

            } else {

                button.textContent =
                    "🔗 SHARE TO UNLOCK";

            }
        }
    }


    /* SHARE APP */

    function shareApp() {

        const shareUrl =
            window.location.href;

        if (navigator.share) {

            navigator.share({

                title: "Yoni",

                text: "Check out Yoni!",

                url: shareUrl

            }).catch(function () {

                console.log("Share cancelled");

            });

        } else {

            if (navigator.clipboard) {

                navigator.clipboard
                    .writeText(shareUrl)
                    .then(function () {

                        alert("🔗 Yoni link copied!");

                    });

            } else {

                alert(
                    "🔗 Share this link:\n\n" +
                    shareUrl
                );

            }
        }
    }


    /* VIDEO PLAYER */

    function openVideo() {

        const overlay =
            document.createElement("div");

        overlay.className =
            "video-overlay";


        const playerBox =
            document.createElement("div");

        playerBox.className =
            "video-player-box";


        const closeButton =
            document.createElement("button");

        closeButton.className =
            "video-close";

        closeButton.textContent =
            "✕";


        const video =
            document.createElement("video");

        video.src =
            "yoni-video-1.mp4";

        video.controls = true;

        video.autoplay = true;

        video.playsInline = true;


        closeButton.addEventListener(
            "click",
            function () {

                video.pause();

                overlay.remove();

            }
        );


        playerBox.appendChild(closeButton);

        playerBox.appendChild(video);

        overlay.appendChild(playerBox);

        document.body.appendChild(overlay);

    }


    /* FIRST PLAY BUTTON */

    const playButtons =
        document.querySelectorAll(".play-button");

    playButtons.forEach(function (button, index) {

        button.addEventListener(
            "click",
            function () {

                if (index === 0) {

                    if (shareCount >= requiredShares) {

                        openVideo();

                    } else {

                        alert(
                            "🔒 Share the app 3 times to unlock this video."
                        );

                    }

                } else {

                    alert(
                        "⭐ This premium video will be connected to Telegram Stars."
                    );

                }

            }
        );

    });


    /* SEARCH */

    const searchButton =
        document.getElementById("searchButton");

    if (searchButton) {

        searchButton.addEventListener(
            "click",
            function () {

                const input =
                    document.getElementById(
                        "searchInput"
                    );

                if (!input) return;

                const query =
                    input.value.trim();

                if (query === "") {

                    alert(
                        "🔍 Type something to search."
                    );

                } else {

                    alert(
                        "Searching for: " + query
                    );

                }

            }
        );

    }


    /* CATEGORIES */

    const categories =
        document.querySelectorAll(".category");

    categories.forEach(function (category) {

        category.addEventListener(
            "click",
            function () {

                categories.forEach(
                    function (item) {

                        item.classList.remove(
                            "active"
                        );

                    }
                );

                category.classList.add(
                    "active"
                );

            }
        );

    });


    /* FAVORITES */

    const favoriteButtons =
        document.querySelectorAll(
            ".favorite-button"
        );

    favoriteButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                if (
                    button.textContent.trim()
                    === "♡"
                ) {

                    button.textContent = "♥";

                    button.style.color =
                        "#ff168f";

                } else {

                    button.textContent = "♡";

                    button.style.color =
                        "#ff45b2";

                }

            }
        );

    });


    /* TELEGRAM STARS PLACEHOLDER */

    const starsButtons =
        document.querySelectorAll(
            ".stars-button"
        );

    starsButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                alert(
                    "⭐ Telegram Stars payment will be connected later."
                );

            }
        );

    });


    /* BOTTOM NAV */

    const navItems =
        document.querySelectorAll(".nav-item");

    navItems.forEach(function (item) {

        item.addEventListener(
            "click",
            function () {

                navItems.forEach(
                    function (nav) {

                        nav.classList.remove(
                            "active"
                        );

                    }
                );

                item.classList.add(
                    "active"
                );

            }
        );

    });


    updateUnlock();

});