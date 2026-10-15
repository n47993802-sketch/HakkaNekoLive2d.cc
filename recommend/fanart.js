const fanartConfig = globalThis.FANART_CONFIG;
const fanartGallery = document.querySelector("[data-fanart-gallery]");
const fanartFilters = document.querySelector("[data-fanart-filters]");
const fanartStatus = document.querySelector("[data-fanart-status]");
const fanartR18Gate = document.querySelector("[data-fanart-r18-gate]");
const fanartR18Consent = document.querySelector("[data-fanart-r18-consent]");
const fanartR18Content = document.querySelector("[data-fanart-r18-content]");
const fanartR18Gallery = document.querySelector("[data-fanart-r18-gallery]");
const fanartR18Status = document.querySelector("[data-fanart-r18-status]");
const fanartR18Retry = document.querySelector("[data-fanart-r18-retry]");
const fanartR18Decline = document.querySelector("[data-fanart-r18-decline]");
const fanartR18Section = document.querySelector(".fanart-r18");

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
  let r18Works = null;
  let activeFanartFilter = "all";
  const r18AssetBase = String(
    fanartConfig.r18AssetBase || `${fanartConfig.assetBase}/R18`,
  ).replace(/\/+$/, "");
  const mediaUrl = (file, assetBase = fanartConfig.assetBase) =>
    `${assetBase}/${encodeURIComponent(file)}`;
  const rawGitHubUrl = (source) => {
    const match = source.match(
      /^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+\/[^/@]+)@([^/]+)\/(.+)$/,
    );
    return match
      ? `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}`
      : null;
  };
  const useRawGitHubFallback = (media) => {
    if (media.dataset.rawGitHubFallback === "true") return false;
    const fallbackUrl = rawGitHubUrl(media.currentSrc || media.src);
    if (!fallbackUrl) return false;
    media.dataset.rawGitHubFallback = "true";
    media.src = fallbackUrl;
    if (typeof media.load === "function") media.load();
    return true;
  };
  const getFileExtension = (file) =>
    file.slice(file.lastIndexOf(".")).toLowerCase();
  const isVideo = (work) => videoExtensions.has(getFileExtension(work.file));
  const getWorkType = (file) => {
    const extension = getFileExtension(file);
    if (videoExtensions.has(extension)) return "animated";
    if (imageExtensions.has(extension)) return "static";
    return null;
  };
  const configuredR18Entries = Array.isArray(fanartConfig.fallbackR18Works)
    ? fanartConfig.fallbackR18Works
    : [];
  const isValidR18File = (file) =>
    typeof file === "string" &&
    file.trim() === file &&
    file.length > 0 &&
    !file.includes("/") &&
    !file.includes("\\") &&
    Boolean(getWorkType(file));
  const invalidR18Entries = configuredR18Entries.filter(
    (file) => !isValidR18File(file),
  );
  if (invalidR18Entries.length) {
    console.warn(
      "已忽略 fanart-config.js 中無效的 R18 檔名。",
      invalidR18Entries,
    );
  }
  const r18FallbackFiles = [
    ...new Set(configuredR18Entries.filter(isValidR18File)),
  ];
  const r18FileSet = new Set(r18FallbackFiles);
  const getMetadataTitle = (file) => {
    const title = fanartConfig.metadata?.[file]?.title;
    return typeof title === "string" && title.trim() ? title.trim() : "";
  };
  const compareFileNames = (first, second) =>
    first.localeCompare(second, "zh-Hant", {
      numeric: true,
      sensitivity: "base",
    });
  const metadataOrder = new Map(
    Object.keys(fanartConfig.metadata || {}).map((file, index) => [
      file,
      index,
    ]),
  );
  const sortFiles = (files) =>
    [...files].sort((first, second) => {
      const firstTitle = getMetadataTitle(first);
      const secondTitle = getMetadataTitle(second);
      const titleOrder =
        Number(!firstTitle) - Number(!secondTitle);
      if (titleOrder) return titleOrder;

      if (firstTitle && secondTitle) {
        const firstOrder = metadataOrder.get(first);
        const secondOrder = metadataOrder.get(second);
        if (firstOrder !== undefined && secondOrder !== undefined) {
          return firstOrder - secondOrder;
        }
      }

      return compareFileNames(first, second);
    });
  const buildWorks = (files, titlePrefix = "") => {
    const counts = { static: 0, animated: 0 };
    return files.flatMap((file) => {
      const type = getWorkType(file);
      if (!type) return [];
      counts[type] += 1;
      const metadata = fanartConfig.metadata?.[file] || {};
      const title =
        getMetadataTitle(file) ||
        `${titlePrefix}${type === "static" ? "靜態" : "動態"}二創 ${String(counts[type]).padStart(2, "0")}`;
      const artist =
        typeof metadata.artist === "string" && metadata.artist.trim()
          ? metadata.artist.trim()
          : "投稿者資訊待確認";
      return [{ file, type, title, artist }];
    });
  };
  const discoverFiles = async (
    endpoint = fanartConfig.directoryApiUrl,
    sectionLabel = "二創",
    allowEmpty = false,
  ) => {
    const apiUrl = String(endpoint || "").trim();
    if (!apiUrl) throw new Error(`未設定${sectionLabel}資料夾清單 API。`);
    const response = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github+json" },
      signal: window.createHakkaTimeoutSignal(8000),
    });
    if (!response.ok) {
      throw new Error(`${sectionLabel}資料夾清單回應錯誤：HTTP ${response.status}`);
    }
    const entries = await response.json();
    if (!Array.isArray(entries)) {
      throw new TypeError(`${sectionLabel}資料夾清單格式無效。`);
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
      .map((entry) => entry.name);
    if (files.length === 0 && !allowEmpty) {
      throw new Error(`${sectionLabel}資料夾內沒有支援的圖片或影片。`);
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
  let activeLightboxAssetBase = fanartConfig.assetBase;

  const displayLightboxItem = () => {
    const work = lightboxItems[lightboxIndex];
    const source = mediaUrl(work.file, activeLightboxAssetBase);
    lightboxVideo.pause();
    delete lightboxVideo.dataset.rawGitHubFallback;
    delete lightboxImage.dataset.rawGitHubFallback;
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

  const openLightbox = (
    work,
    collection = works,
    assetBase = fanartConfig.assetBase,
  ) => {
    lightboxItems = collection.filter((item) => item.type === work.type);
    activeLightboxAssetBase = assetBase;
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
    if (useRawGitHubFallback(lightboxVideo)) {
      lightboxVideo.play().catch((error) => {
        if (
          error.name !== "NotAllowedError" &&
          error.name !== "AbortError" &&
          error.name !== "NotSupportedError"
        ) {
          console.warn("二創燈箱動畫備援播放失敗。", error);
        }
      });
      return;
    }
    lightboxVideo.style.display = "none";
    lightboxFallback.hidden = false;
  });
  lightboxImage.addEventListener("error", () => {
    if (!lightbox.open || activeLightboxMedia !== "image") return;
    if (useRawGitHubFallback(lightboxImage)) return;
    lightboxImage.style.display = "none";
    lightboxFallback.hidden = false;
  });

  const previewVideos = [];
  let previewVideoObserver;
  const observePreviewVideos = (videos) => {
    if (
      !videos.length ||
      !("IntersectionObserver" in window) ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    if (!previewVideoObserver) {
      previewVideoObserver = new IntersectionObserver(
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
    }
    videos.forEach((video) => previewVideoObserver.observe(video));
  };
  const createFanartCard = (
    work,
    collection = works,
    assetBase = fanartConfig.assetBase,
  ) => {
    const card = document.createElement("article");
    card.className = "fanart-card";
    card.dataset.fanartType = work.type;

    const media = document.createElement("div");
    media.className = "fanart-media is-loading";
    const button = document.createElement("button");
    button.className = "fanart-media-button";
    button.type = "button";
    button.setAttribute("aria-label", `${work.title}，開啟燈箱`);
    button.addEventListener("click", () =>
      openLightbox(work, collection, assetBase),
    );

    const source = mediaUrl(work.file, assetBase);
    if (isVideo(work)) {
      const video = document.createElement("video");
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = "none";
      video.setAttribute("aria-label", `${work.title}動畫預覽`);
      video.addEventListener(
        "loadeddata",
        () => {
          video.classList.add("is-loaded");
          media.classList.remove("is-loading");
        },
        { once: true },
      );

      const fallback = document.createElement("span");
      fallback.className = "work-video-fallback";
      fallback.textContent = "預覽目前無法播放，點按縮圖可開啟燈箱。";
      fallback.hidden = true;
      video.addEventListener(
        "error",
        () => {
          if (useRawGitHubFallback(video)) {
            video.play().catch((error) => {
              if (
                error.name !== "NotAllowedError" &&
                error.name !== "AbortError" &&
                error.name !== "NotSupportedError"
              ) {
                console.warn("二創動畫備援播放失敗。", error);
              }
            });
            return;
          }
          media.classList.remove("is-loading");
          video.style.display = "none";
          fallback.hidden = false;
        },
      );
      video.src = source;
      button.append(video, fallback);
      previewVideos.push(video);
    } else {
      const image = document.createElement("img");
      image.alt = work.title;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener(
        "load",
        () => {
          image.classList.add("is-loaded");
          media.classList.remove("is-loading");
        },
        { once: true },
      );
      image.addEventListener(
        "error",
        () => {
          if (useRawGitHubFallback(image)) return;
          image.classList.add("is-loaded");
          media.classList.remove("is-loading");
          console.error(`二創作品圖片載入失敗：${work.file}`);
        },
        { once: true },
      );
      image.src = source;
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

  const renderFilters = () => {
    const r18CountByType = (type) =>
      r18Works?.filter((work) => work.type === type).length || 0;
    const filters = [
      {
        id: "all",
        label: "全部作品",
        count:
          works.length + (r18Works === null ? 0 : r18Works.length),
      },
      {
        id: "static",
        label: "靜態二創",
        count:
          works.filter((work) => work.type === "static").length +
          r18CountByType("static"),
      },
      {
        id: "animated",
        label: "動態二創",
        count:
          works.filter((work) => work.type === "animated").length +
          r18CountByType("animated"),
      },
      {
        id: "r18",
        label: "R18 二創",
        count: r18Works === null ? null : r18Works.length,
      },
    ];
    fanartFilters.replaceChildren(
      ...filters.map((filter) => {
        const selected = filter.id === activeFanartFilter;
        const button = document.createElement("button");
        button.className = `filter-button${selected ? " active" : ""}`;
        button.type = "button";
        button.dataset.fanartFilter = filter.id;
        button.setAttribute("aria-pressed", String(selected));
        button.textContent =
          filter.count === null
            ? filter.label
            : `${filter.label} (${filter.count})`;
        return button;
      }),
    );
  };

  const applyFanartFilter = (filter) => {
    activeFanartFilter = filter;
    fanartGallery.querySelectorAll(".fanart-card").forEach((card) => {
      const hidden =
        filter === "r18" ||
        (filter !== "all" && card.dataset.fanartType !== filter);
      card.hidden = hidden;
      if (hidden) card.querySelector("video")?.pause();
    });
    fanartR18Gallery?.querySelectorAll(".fanart-card").forEach((card) => {
      const hidden =
        filter !== "all" &&
        filter !== "r18" &&
        card.dataset.fanartType !== filter;
      card.hidden = hidden;
      if (hidden) card.querySelector("video")?.pause();
    });
    if (filter === "r18") {
      fanartR18Section?.scrollIntoView({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }
  };

  const selectFanartFilter = (filter) => {
    fanartFilters.querySelectorAll("[data-fanart-filter]").forEach((item) => {
      const selected = item.dataset.fanartFilter === filter;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    applyFanartFilter(filter);
  };

  fanartFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fanart-filter]");
    if (!button || !fanartFilters.contains(button)) return;
    selectFanartFilter(button.dataset.fanartFilter);
  });

  const renderWorks = () => {
    fanartGallery.replaceChildren(
      ...works.map((work) => createFanartCard(work)),
    );
    renderFilters();
    applyFanartFilter(activeFanartFilter);
    observePreviewVideos(previewVideos);
  };

  if (
    fanartR18Gate &&
    fanartR18Consent &&
    fanartR18Content &&
    fanartR18Gallery &&
    fanartR18Status &&
    fanartR18Retry &&
    fanartR18Decline
  ) {
    const loadR18Works = async () => {
      fanartR18Retry.hidden = true;
      fanartR18Status.textContent = "正在讀取 R18 作品清單……";
      let r18Files;
      let usedFallback = false;
      try {
        r18Files = await discoverFiles(
          fanartConfig.r18DirectoryApiUrl,
          "R18",
          true,
        );
      } catch (error) {
        console.warn("無法自動讀取 fanart/R18，改用設定檔備援清單。", error);
        r18Files = r18FallbackFiles;
        usedFallback = true;
      }

      const firstR18VideoIndex = previewVideos.length;
      const loadedR18Works = buildWorks(sortFiles(r18Files), "R18 ");
      r18Works =
        usedFallback && loadedR18Works.length === 0
          ? null
          : loadedR18Works;
      fanartR18Gallery.replaceChildren(
        ...loadedR18Works.map((work) =>
          createFanartCard(work, loadedR18Works, r18AssetBase),
        ),
      );
      observePreviewVideos(previewVideos.slice(firstR18VideoIndex));
      renderFilters();
      applyFanartFilter(activeFanartFilter);
      fanartR18Gate.hidden = true;
      fanartR18Content.hidden = false;
      fanartR18Status.textContent = loadedR18Works.length
        ? usedFallback
          ? `無法自動讀取 R18 資料夾，暫以設定檔備援清單顯示 ${loadedR18Works.length} 件作品。`
          : `已從 fanart/R18 讀取 ${loadedR18Works.length} 件作品。`
        : usedFallback
          ? "無法讀取 R18 資料夾清單，請稍後重試。"
          : "fanart/R18 目前沒有可展示的作品。";
      fanartR18Retry.hidden = !usedFallback || loadedR18Works.length > 0;
    };

    fanartR18Consent.addEventListener("click", () => {
      fanartR18Gate.hidden = true;
      fanartR18Content.hidden = false;
      void loadR18Works();
    });
    fanartR18Decline.addEventListener("click", () => {
      selectFanartFilter("all");
      fanartGallery.scrollIntoView({
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
    fanartR18Retry.addEventListener("click", () => {
      void loadR18Works();
    });
  }

  const loadWorks = async () => {
    const fallbackWorks = buildWorks(
      sortFiles(fallbackFiles.filter((file) => !r18FileSet.has(file))),
    );
    works = fallbackWorks;
    renderWorks();
    if (fanartStatus) {
      fanartStatus.textContent = works.length
        ? `正在更新作品清單，已先顯示 ${works.length} 件作品。`
        : "正在讀取二創作品清單……";
    }
    window.dispatchEvent(
      new CustomEvent("page-content-ready", {
        detail: { page: "recommend", part: "fanart", items: works.length },
      }),
    );

    try {
      const files = await discoverFiles();
      const discoveredWorks = buildWorks(
        sortFiles(files.filter((file) => !r18FileSet.has(file))),
      );
      const worksChanged =
        discoveredWorks.length !== works.length ||
        discoveredWorks.some((work, index) => work.file !== works[index].file);
      works = discoveredWorks;
      if (worksChanged) renderWorks();
      if (fanartStatus) {
        fanartStatus.textContent = `已從資料夾自動讀取 ${works.length} 件二創作品。`;
      }
    } catch (error) {
      console.warn("無法自動讀取二創資料夾，改用設定檔備援清單。", error);
      if (fanartStatus) {
        fanartStatus.textContent = works.length
          ? `無法自動讀取資料夾，暫以設定檔備援清單顯示 ${works.length} 件作品。`
          : "目前沒有可展示的作品。";
      }
    }
  };

  void loadWorks()
    .catch((error) => {
      console.error("二創清單載入時發生未預期錯誤。", error);
      if (fanartStatus) {
        fanartStatus.textContent = "二創資料暫時無法載入，請稍後再試。";
      }
    });
}
