const worksConfig = globalThis.WORKS_CONFIG;
const worksGallery = document.querySelector("#work-gallery");
const worksFilters = document.querySelector("[data-work-filters]");

if (worksConfig && worksGallery && worksFilters) {
  const previewVideos = [];
  const items = [
    ...worksConfig.models.map((item) => ({
      ...item,
      category: "model",
      mediaType: "model",
    })),
    ...worksConfig.stickers.map((item) => ({
      ...item,
      category: "sticker",
      mediaType: "video",
    })),
    ...worksConfig.logos.map((item) => ({
      ...item,
      category: "logo",
      mediaType: "video",
    })),
    ...worksConfig.publishedWorks.map((item) => ({
      ...item,
      mediaType: item.mediaType || "image",
      clickBehavior: "link",
    })),
  ];

  const mediaUrl = (path) =>
    path.startsWith("http") || path.startsWith("../")
      ? path
      : `${worksConfig.assetBase}/${path}`;
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

  const lightbox = document.createElement("dialog");
  lightbox.className = "work-lightbox";
  lightbox.setAttribute("aria-labelledby", "work-lightbox-title");

  const lightboxClose = document.createElement("button");
  lightboxClose.className = "work-lightbox-close";
  lightboxClose.type = "button";
  lightboxClose.setAttribute("aria-label", "關閉燈箱");
  lightboxClose.textContent = "close";

  const lightboxPrevious = document.createElement("button");
  lightboxPrevious.className = "work-lightbox-control work-lightbox-previous";
  lightboxPrevious.type = "button";
  lightboxPrevious.setAttribute("aria-label", "上一個作品");
  lightboxPrevious.textContent = "chevron_left";

  const lightboxNext = document.createElement("button");
  lightboxNext.className = "work-lightbox-control work-lightbox-next";
  lightboxNext.type = "button";
  lightboxNext.setAttribute("aria-label", "下一個作品");
  lightboxNext.textContent = "chevron_right";

  const lightboxContent = document.createElement("div");
  lightboxContent.className = "work-lightbox-content";

  const lightboxVideo = document.createElement("video");
  lightboxVideo.className = "work-lightbox-video";
  lightboxVideo.controls = true;
  lightboxVideo.setAttribute("controlslist", "nodownload");
  lightboxVideo.loop = true;
  lightboxVideo.muted = true;
  lightboxVideo.playsInline = true;
  lightboxVideo.preload = "metadata";
  lightboxVideo.setAttribute("aria-label", "作品動畫預覽");

  const lightboxFallback = document.createElement("p");
  lightboxFallback.className = "work-lightbox-fallback";
  lightboxFallback.textContent = "此瀏覽器無法播放這段動畫。";
  lightboxFallback.hidden = true;
  lightboxContent.append(lightboxVideo, lightboxFallback);

  const lightboxTitle = document.createElement("h2");
  lightboxTitle.className = "work-lightbox-title";
  lightboxTitle.id = "work-lightbox-title";

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
  const videoItems = items.filter((item) => item.mediaType === "video");

  const displayLightboxItem = () => {
    const item = lightboxItems[lightboxIndex];
    lightboxVideo.pause();
    delete lightboxVideo.dataset.rawGitHubFallback;
    lightboxVideo.style.display = "";
    lightboxFallback.hidden = true;
    lightboxTitle.textContent = item.title;
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;
    lightboxVideo.setAttribute("aria-label", `${item.title}動畫預覽`);
    lightboxVideo.src = mediaUrl(item.media);
    lightboxVideo.play().catch((error) => {
      if (
        error.name !== "NotAllowedError" &&
        error.name !== "AbortError" &&
        error.name !== "NotSupportedError"
      ) {
        console.warn("燈箱動畫播放失敗。", error);
      }
    });
  };

  const moveLightbox = (direction) => {
    if (lightboxItems.length < 2) return;
    lightboxIndex =
      (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
    displayLightboxItem();
  };

  const closeLightbox = () => lightbox.close();
  const openVideoLightbox = (item) => {
    lightboxItems = videoItems.filter(
      (videoItem) => videoItem.category === item.category,
    );
    lightboxIndex = Math.max(
      0,
      lightboxItems.findIndex((videoItem) => videoItem.id === item.id),
    );
    lightbox.showModal();
    displayLightboxItem();
  };

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
    lightboxItems = [];
  });
  lightboxVideo.addEventListener("error", () => {
    if (!lightbox.open) return;
    if (useRawGitHubFallback(lightboxVideo)) {
      lightboxVideo.play().catch((error) => {
        if (
          error.name !== "NotAllowedError" &&
          error.name !== "AbortError" &&
          error.name !== "NotSupportedError"
        ) {
          console.warn("燈箱動畫備援播放失敗。", error);
        }
      });
      return;
    }
    lightboxVideo.style.display = "none";
    lightboxFallback.hidden = false;
  });

  const createWorkItem = (item) => {
    const article = document.createElement("article");
    article.className = "work-item";
    article.dataset.category = item.category;
    article.dataset.workId = item.id;

    const thumb = document.createElement("div");
    thumb.className = "work-thumb";

    if (item.mediaType === "video") {
      const mediaControl =
        item.clickBehavior === "link"
          ? document.createElement("a")
          : document.createElement("button");
      mediaControl.className =
        item.clickBehavior === "link" ? "work-media-link" : "work-media-button";
      if (item.clickBehavior === "link") {
        mediaControl.href = item.href;
        mediaControl.target = "_blank";
        mediaControl.rel = "noopener noreferrer";
        mediaControl.setAttribute(
          "aria-label",
          `${item.title}，開啟作品原始頁面`,
        );
      } else {
        mediaControl.type = "button";
        mediaControl.setAttribute("aria-label", `${item.title}，開啟燈箱預覽`);
        mediaControl.addEventListener("click", () => openVideoLightbox(item));
      }

      const video = document.createElement("video");
      video.src = mediaUrl(item.media);
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = "none";
      video.setAttribute("aria-label", `${item.title}動畫預覽`);
      const fallback = document.createElement("span");
      fallback.className = "work-video-fallback";
      fallback.textContent =
        item.clickBehavior === "link"
          ? "預覽目前無法播放，點按縮圖可前往作品頁面。"
          : "預覽目前無法播放，點按縮圖可嘗試開啟燈箱。";
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
                console.warn("作品動畫備援播放失敗。", error);
              }
            });
            return;
          }
          video.style.display = "none";
          fallback.hidden = false;
        },
      );
      mediaControl.append(video, fallback);
      thumb.append(mediaControl);
      previewVideos.push(video);
    } else if (item.mediaType === "model" && !item.media) {
      const modelPreview = document.createElement("span");
      modelPreview.className = "work-model-preview";
      modelPreview.textContent = "LIVE2D MODEL";
      thumb.append(modelPreview);
    } else {
      const link = document.createElement("a");
      link.className = "work-media-link";
      link.href = item.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `${item.title}，開啟作品原始頁面`);

      const image = document.createElement("img");
      image.src = mediaUrl(item.media);
      image.alt = item.mediaAlt;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        if (useRawGitHubFallback(image)) return;
        console.error(`作品圖片載入失敗：${item.media}`);
      });
      link.append(image);
      thumb.append(link);
    }

    article.append(thumb);

    if (item.format) {
      const format = document.createElement("small");
      format.textContent = item.format;
      article.append(format);
    }

    const title = document.createElement("h2");
    title.textContent = item.title;
    article.append(title);

    const descriptionText =
      item.description || (item.artist ? `繪師：${item.artist}` : "");
    if (descriptionText) {
      const description = document.createElement("p");
      description.textContent = descriptionText;
      article.append(description);
    }

    if (item.tags?.length) {
      const tags = document.createElement("div");
      tags.className = "work-tags";
      tags.setAttribute("aria-label", "作品標籤");
      item.tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.textContent = tag;
        tags.append(chip);
      });
      article.append(tags);
    }

    return article;
  };

  const categoryCounts = new Map(
    worksConfig.categories.map((category) => [
      category.id,
      category.id === "all"
        ? items.length
        : items.filter((item) => item.category === category.id).length,
    ]),
  );
  const groupStates = new Map();
  const groupFragment = document.createDocumentFragment();
  const navFragment = document.createDocumentFragment();

  worksConfig.categories.forEach((category, index) => {
    const groupId = `work-group-${category.id}`;
    const count = categoryCounts.get(category.id) || 0;

    const tab = document.createElement("button");
    tab.className = "work-category-tab";
    tab.type = "button";
    tab.id = `work-tab-${category.id}`;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "work-gallery");
    tab.setAttribute("aria-selected", String(index === 0));
    tab.dataset.workCategory = category.id;
    tab.textContent = `${category.label} (${count})`;
    navFragment.append(tab);

    if (category.id === "all") return;

    const section = document.createElement("section");
    section.className = "work-group";
    section.id = groupId;
    section.dataset.category = category.id;
    section.setAttribute("aria-labelledby", `${groupId}-title`);
    section.hidden = true;

    const heading = document.createElement("div");
    heading.className = "work-group-heading";

    const title = document.createElement("h2");
    title.className = "work-group-title";
    title.id = `${groupId}-title`;
    title.textContent = category.label;

    const countLabel = document.createElement("span");
    countLabel.className = "work-group-count";
    countLabel.textContent = `${count} 件作品`;

    const pager = document.createElement("div");
    pager.className = "work-group-pager";
    pager.hidden = true;

    const previous = document.createElement("button");
    previous.className = "work-pager-button";
    previous.type = "button";
    previous.setAttribute("aria-label", `${category.label}上一頁`);
    previous.textContent = "chevron_left";

    const pageIndicator = document.createElement("span");
    pageIndicator.className = "work-page-indicator";
    pageIndicator.setAttribute("aria-live", "polite");

    const next = document.createElement("button");
    next.className = "work-pager-button";
    next.type = "button";
    next.setAttribute("aria-label", `${category.label}下一頁`);
    next.textContent = "chevron_right";

    pager.append(previous, pageIndicator, next);
    const headingActions = document.createElement("div");
    headingActions.className = "work-group-actions";
    headingActions.append(countLabel, pager);

    const grid = document.createElement("div");
    grid.className = "work-grid";
    grid.setAttribute("aria-label", category.label);

    heading.append(title, headingActions);
    section.append(heading, grid);
    groupFragment.append(section);
    groupStates.set(category.id, {
      section,
      grid,
      pager,
      previous,
      next,
      pageIndicator,
      pageIndex: 0,
    });
  });

  items.forEach((item) => {
    const group = groupStates.get(item.category);
    if (!group) {
      throw new Error(`作品「${item.title}」沒有對應的分類區塊：${item.category}`);
    }
    group.grid.append(createWorkItem(item));
  });

  worksGallery.replaceChildren(groupFragment);
  worksGallery.setAttribute("role", "tabpanel");
  worksGallery.tabIndex = 0;
  worksFilters.replaceChildren(navFragment);

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
                console.warn("動態作品預覽播放失敗。", error);
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

  const categoryLinks = [...worksFilters.querySelectorAll("[data-work-category]")];
  const pageSize = () =>
    window.matchMedia("(max-width: 700px)").matches ? 4 : 6;
  let activeCategory = "all";

  const renderGroup = (group) => {
    const cards = [...group.grid.children];
    const totalPages = Math.max(1, Math.ceil(cards.length / pageSize()));

    group.pageIndex = Math.min(group.pageIndex, totalPages - 1);
    group.pager.hidden = activeCategory !== "all" || totalPages <= 1;

    if (activeCategory !== "all") {
      cards.forEach((card) => {
        card.hidden = false;
      });
      return;
    }

    const firstCard = group.pageIndex * pageSize();
    cards.forEach((card, index) => {
      card.hidden = index < firstCard || index >= firstCard + pageSize();
    });
    group.pageIndicator.textContent = `${group.pageIndex + 1} / ${totalPages}`;
    group.previous.disabled = group.pageIndex === 0;
    group.next.disabled = group.pageIndex >= totalPages - 1;
  };

  groupStates.forEach((group) => {
    group.previous.addEventListener("click", () => {
      group.pageIndex = Math.max(0, group.pageIndex - 1);
      renderGroup(group);
    });
    group.next.addEventListener("click", () => {
      const totalPages = Math.ceil(group.grid.children.length / pageSize());
      group.pageIndex = Math.min(totalPages - 1, group.pageIndex + 1);
      renderGroup(group);
    });
  });

  const setActiveCategory = (categoryId) => {
    const changed = activeCategory !== categoryId;
    activeCategory = categoryId;
    categoryLinks.forEach((link) => {
      const selected = link.dataset.workCategory === categoryId;
      link.setAttribute("aria-selected", String(selected));
      link.classList.toggle("active", selected);
    });
    worksGallery.setAttribute("aria-labelledby", `work-tab-${categoryId}`);
    groupStates.forEach((group, groupId) => {
      group.section.hidden =
        categoryId !== "all" && groupId !== categoryId;
      group.section.classList.remove("work-category-enter");
      if (
        changed &&
        !group.section.hidden &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        void group.section.offsetWidth;
        group.section.classList.add("work-category-enter");
      }
      renderGroup(group);
    });
  };

  worksFilters.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-work-category]");
    if (!tab || !worksFilters.contains(tab)) return;
    setActiveCategory(tab.dataset.workCategory);
  });

  worksFilters.addEventListener("keydown", (event) => {
    const currentTab = event.target.closest("[data-work-category]");
    if (!currentTab || !worksFilters.contains(currentTab)) return;

    const direction =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (!direction) return;

    event.preventDefault();
    const currentIndex = categoryLinks.indexOf(currentTab);
    const nextIndex =
      (currentIndex + direction + categoryLinks.length) % categoryLinks.length;
    const nextTab = categoryLinks[nextIndex];
    nextTab.focus();
    setActiveCategory(nextTab.dataset.workCategory);
  });

  const updateTabOrientation = () => {
    worksFilters.setAttribute(
      "aria-orientation",
      window.matchMedia("(max-width: 700px)").matches ? "horizontal" : "vertical",
    );
  };
  window.addEventListener("resize", () => {
    updateTabOrientation();
    if (activeCategory === "all") {
      groupStates.forEach(renderGroup);
    }
  });
  setActiveCategory("all");
  updateTabOrientation();

  window.dispatchEvent(
    new CustomEvent("page-content-ready", {
      detail: {
        page: "works",
        part: "gallery",
        items: worksGallery.querySelectorAll(".work-item:not([hidden])").length,
      },
    }),
  );
} else if (worksGallery && worksFilters) {
  console.error("作品資料設定未載入，無法建立作品清單。");
  const warning = document.querySelector("[data-content-load-warning]");
  if (warning) {
    warning.textContent = "作品資料設定無法載入，請稍後重新整理。";
    warning.hidden = false;
  }
  window.dispatchEvent(
    new CustomEvent("page-content-ready", {
      detail: { page: "works", part: "media", items: 0 },
    }),
  );
}
