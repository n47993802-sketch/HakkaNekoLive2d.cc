const fanartConfig = globalThis.FANART_CONFIG;
const fanartGallery = document.querySelector("[data-fanart-gallery]");
const fanartFilters = document.querySelector("[data-fanart-filters]");
const fanartStatus = document.querySelector("[data-fanart-status]");

if (fanartConfig && fanartGallery && fanartFilters) {
  const imageExtensions = new Set([
    ".apng",
    ".avif",
    ".gif",
    ".jpeg",
    ".jpg",
    ".png",
    ".webp",
  ]);
  const videoExtensions = new Set([".mp4", ".ogg", ".ogv", ".webm"]);
  const fallbackFiles = [
    ...(fanartConfig.fallbackStaticWorks || []),
    ...(fanartConfig.fallbackAnimatedWorks || []),
  ];
  let works = [];
  const mediaUrl = (file) =>
    `${fanartConfig.assetBase}/${encodeURIComponent(file)}`;
  const getFileExtension = (file) =>
    file.slice(file.lastIndexOf(".")).toLowerCase();
  const isVideo = (work) => videoExtensions.has(getFileExtension(work.file));
  const getWorkType = (file) => {
    const extension = getFileExtension(file);
    if (videoExtensions.has(extension)) return "animated";
    if (imageExtensions.has(extension)) return "static";
    return null;
  };
  const buildWorks = (files) => {
    const counts = { static: 0, animated: 0 };
    return files.flatMap((file) => {
      const type = getWorkType(file);
      if (!type) return [];
      counts[type] += 1;
      const metadata = fanartConfig.metadata?.[file] || {};
      const title =
        typeof metadata.title === "string" && metadata.title.trim()
          ? metadata.title.trim()
          : `${type === "static" ? "靜態" : "動態"}二創 ${String(counts[type]).padStart(2, "0")}`;
      const artist =
        typeof metadata.artist === "string" && metadata.artist.trim()
          ? metadata.artist.trim()
          : "投稿者資訊待確認";
      return [{ file, type, title, artist }];
    });
  };
  const discoverFiles = async () => {
    const endpoint = String(fanartConfig.directoryApiUrl || "").trim();
    if (!endpoint) throw new Error("未設定二創資料夾清單 API。");
    const response = await fetch(endpoint, {
      headers: { Accept: "application/vnd.github+json" },
      signal: window.createHakkaTimeoutSignal(8000),
    });
    if (!response.ok) {
      throw new Error(`二創資料夾清單回應錯誤：HTTP ${response.status}`);
    }
    const entries = await response.json();
    if (!Array.isArray(entries)) {
      throw new TypeError("二創資料夾清單格式無效。");
    }
    const files = entries
      .filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          entry.type === "file" &&
          typeof entry.name === "string" &&
          !entry.name.includes("/") &&
          !entry.name.includes("\\") &&
          getWorkType(entry.name),
      )
      .map((entry) => entry.name)
      .sort((first, second) => {
        const typeOrder =
          Number(videoExtensions.has(getFileExtension(first))) -
          Number(videoExtensions.has(getFileExtension(second)));
        return (
          typeOrder ||
          first.localeCompare(second, "zh-Hant", {
            numeric: true,
            sensitivity: "base",
          })
        );
      });
    if (files.length === 0) {
      throw new Error("二創資料夾內沒有支援的圖片或影片。");
    }
    return files;
  };

  const lightbox = document.createElement("dialog");
  lightbox.className = "work-lightbox";
  lightbox.setAttribute("aria-labelledby", "fanart-lightbox-title");

  const lightboxClose = document.createElement("button");
  lightboxClose.className = "work-lightbox-close";
  lightboxClose.type = "button";
  lightboxClose.setAttribute("aria-label", "關閉燈箱");
  lightboxClose.textContent = "close";

  const lightboxPrevious = document.createElement("button");
  lightboxPrevious.className =
    "work-lightbox-control work-lightbox-previous";
  lightboxPrevious.type = "button";
  lightboxPrevious.setAttribute("aria-label", "上一個二創作品");
  lightboxPrevious.textContent = "chevron_left";

  const lightboxNext = document.createElement("button");
  lightboxNext.className = "work-lightbox-control work-lightbox-next";
  lightboxNext.type = "button";
  lightboxNext.setAttribute("aria-label", "下一個二創作品");
  lightboxNext.textContent = "chevron_right";

  const lightboxContent = document.createElement("div");
  lightboxContent.className = "work-lightbox-content";

  const lightboxVideo = document.createElement("video");
  lightboxVideo.className = "work-lightbox-video";
  lightboxVideo.controls = true;
  lightboxVideo.loop = true;
  lightboxVideo.muted = true;
  lightboxVideo.playsInline = true;
  lightboxVideo.preload = "metadata";

  const lightboxImage = document.createElement("img");
  lightboxImage.className = "work-lightbox-image";

  const lightboxFallback = document.createElement("p");
  lightboxFallback.className = "work-lightbox-fallback";
  lightboxFallback.textContent = "此瀏覽器無法載入這份二創作品。";
  lightboxFallback.hidden = true;
  lightboxContent.append(lightboxVideo, lightboxImage, lightboxFallback);

  const lightboxTitle = document.createElement("h2");
  lightboxTitle.className = "work-lightbox-title";
  lightboxTitle.id = "fanart-lightbox-title";

  const lightboxCounter = document.createElement("span");
  lightboxCounter.className = "work-lightbox-counter";

  lightbox.append(
    lightboxClose,
    lightboxPrevious,
    lightboxContent,
    lightboxNext,
    lightboxTitle,
    lightboxCounter,
  );
  document.body.append(lightbox);

  let lightboxItems = [];
  let lightboxIndex = 0;
  let activeLightboxMedia = "";

  const displayLightboxItem = () => {
    const work = lightboxItems[lightboxIndex];
    const source = mediaUrl(work.file);
    lightboxVideo.pause();
    lightboxVideo.style.display = "none";
    lightboxImage.style.display = "none";
    lightboxFallback.hidden = true;
    lightboxTitle.textContent = work.title;
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;

    if (isVideo(work)) {
      activeLightboxMedia = "video";
      lightboxImage.removeAttribute("src");
      lightboxVideo.setAttribute("aria-label", work.title);
      lightboxVideo.style.display = "";
      lightboxVideo.src = source;
      lightboxVideo.play().catch((error) => {
        if (
          error.name !== "NotAllowedError" &&
          error.name !== "AbortError" &&
          error.name !== "NotSupportedError"
        ) {
          console.warn("二創燈箱動畫播放失敗。", error);
        }
      });
      return;
    }

    activeLightboxMedia = "image";
    lightboxVideo.removeAttribute("src");
    lightboxVideo.load();
    lightboxImage.alt = work.title;
    lightboxImage.style.display = "";
    lightboxImage.src = source;
  };

  const moveLightbox = (direction) => {
    if (lightboxItems.length < 2) return;
    lightboxIndex =
      (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
    displayLightboxItem();
  };

  const openLightbox = (work) => {
    lightboxItems = works.filter((item) => item.type === work.type);
    lightboxIndex = Math.max(
      0,
      lightboxItems.findIndex((item) => item.file === work.file),
    );
    lightbox.showModal();
    displayLightboxItem();
  };

  const closeLightbox = () => lightbox.close();
  lightboxClose.addEventListener("click", closeLightbox);
  lightboxPrevious.addEventListener("click", () => moveLightbox(-1));
  lightboxNext.addEventListener("click", () => moveLightbox(1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (event.target === lightboxVideo) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveLightbox(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveLightbox(1);
    }
  });
  lightbox.addEventListener("close", () => {
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
    lightboxVideo.load();
    lightboxImage.removeAttribute("src");
    lightboxItems = [];
    activeLightboxMedia = "";
  });
  lightboxVideo.addEventListener("error", () => {
    if (!lightbox.open || activeLightboxMedia !== "video") return;
    lightboxVideo.style.display = "none";
    lightboxFallback.hidden = false;
  });
  lightboxImage.addEventListener("error", () => {
    if (!lightbox.open || activeLightboxMedia !== "image") return;
    lightboxImage.style.display = "none";
    lightboxFallback.hidden = false;
  });

  const previewVideos = [];
  const createFanartCard = (work) => {
    const card = document.createElement("article");
    card.className = "fanart-card";
    card.dataset.fanartType = work.type;

    const media = document.createElement("div");
    media.className = "fanart-media";
    const button = document.createElement("button");
    button.className = "fanart-media-button";
    button.type = "button";
    button.setAttribute("aria-label", `${work.title}，開啟燈箱`);
    button.addEventListener("click", () => openLightbox(work));

    const source = mediaUrl(work.file);
    if (isVideo(work)) {
      const video = document.createElement("video");
      video.src = source;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = "none";
      video.setAttribute("aria-label", `${work.title}動畫預覽`);

      const fallback = document.createElement("span");
      fallback.className = "work-video-fallback";
      fallback.textContent = "預覽目前無法播放，點按縮圖可開啟燈箱。";
      fallback.hidden = true;
      video.addEventListener(
        "error",
        () => {
          video.style.display = "none";
          fallback.hidden = false;
        },
        { once: true },
      );
      button.append(video, fallback);
      previewVideos.push(video);
    } else {
      const image = document.createElement("img");
      image.src = source;
      image.alt = work.title;
      image.loading = "lazy";
      image.decoding = "async";
      button.append(image);
    }
    media.append(button);
    card.append(media);

    const title = document.createElement("h3");
    title.textContent = work.title;
    card.append(title);

    const credit = document.createElement("p");
    credit.className = "fanart-credit";
    credit.textContent = work.artist;
    card.append(credit);
    return card;
  };

  fanartFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fanart-filter]");
    if (!button || !fanartFilters.contains(button)) return;
    const filter = button.dataset.fanartFilter;
    fanartFilters.querySelectorAll("[data-fanart-filter]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    fanartGallery.querySelectorAll(".fanart-card").forEach((card) => {
      const hidden =
        filter !== "all" && card.dataset.fanartType !== filter;
      card.hidden = hidden;
      if (hidden) card.querySelector("video")?.pause();
    });
  });

  const renderWorks = () => {
    fanartGallery.replaceChildren(...works.map(createFanartCard));
    registerRevealTargets(fanartGallery.querySelectorAll(".fanart-card"));

    const filters = [
      { id: "all", label: "全部作品", count: works.length },
      {
        id: "static",
        label: "靜態二創",
        count: works.filter((work) => work.type === "static").length,
      },
      {
        id: "animated",
        label: "動態二創",
        count: works.filter((work) => work.type === "animated").length,
      },
    ];
    fanartFilters.replaceChildren(
      ...filters.map((filter, index) => {
        const button = document.createElement("button");
        button.className = `filter-button${index === 0 ? " active" : ""}`;
        button.type = "button";
        button.dataset.fanartFilter = filter.id;
        button.setAttribute("aria-pressed", String(index === 0));
        button.textContent = `${filter.label} (${filter.count})`;
        return button;
      }),
    );

    if (
      previewVideos.length &&
      "IntersectionObserver" in window &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      const videoObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.play().catch((error) => {
                if (
                  error.name !== "NotAllowedError" &&
                  error.name !== "AbortError" &&
                  error.name !== "NotSupportedError"
                ) {
                  console.warn("動態二創預覽播放失敗。", error);
                }
              });
            } else {
              entry.target.pause();
            }
          });
        },
        { threshold: 0.25 },
      );
      previewVideos.forEach((video) => videoObserver.observe(video));
    }
  };

  const loadWorks = async () => {
    let files;
    let usedFallback = false;
    try {
      files = await discoverFiles();
    } catch (error) {
      console.warn("無法自動讀取二創資料夾，改用設定檔備援清單。", error);
      files = fallbackFiles;
      usedFallback = true;
    }

    works = buildWorks(files);
    renderWorks();
    if (fanartStatus) {
      fanartStatus.textContent = works.length
        ? usedFallback
          ? `無法自動讀取資料夾，暫以設定檔備援清單顯示 ${works.length} 件作品。`
          : `已從資料夾自動讀取 ${works.length} 件二創作品。`
        : "目前沒有可展示的二創作品。";
    }
  };

  void loadWorks()
    .catch((error) => {
      console.error("二創清單載入時發生未預期錯誤。", error);
      if (fanartStatus) {
        fanartStatus.textContent = "二創資料暫時無法載入，請稍後再試。";
      }
    })
    .finally(() => {
      window.dispatchEvent(
        new CustomEvent("page-content-ready", {
          detail: { page: "recommend", part: "fanart", items: works.length },
        }),
      );
    });
}
