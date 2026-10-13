window.createHakkaTimeoutSignal = (timeoutMs) => {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
};

document.addEventListener("contextmenu", (event) => {
  if (event.button === 2) event.preventDefault();
});
document.addEventListener("dragstart", (event) => event.preventDefault());

const pageLoader = document.querySelector("[data-page-loader]");
if (pageLoader) {
  const pageName = pageLoader.dataset.pageLoaderPage;
  const expectedParts = new Set(
    (pageLoader.dataset.pageLoaderWaitFor || "").split(/\s+/).filter(Boolean),
  );

  if (pageName && expectedParts.size > 0) {
    document.body.classList.add("page-data-loading");
    const completedParts = new Set();
    const completedItemCounts = new Map();
    const minimumReadyItems =
      Number(pageLoader.dataset.pageLoaderMinimumReadyItems) || 0;
    const minimumDisplayTime = 400;
    const startedAt = performance.now();
    let dismissScheduled = false;
    let dismissed = false;

    const dismissPageLoader = () => {
      if (dismissed) return;
      dismissed = true;
      pageLoader.classList.add("is-hidden");
      window.setTimeout(() => {
        pageLoader.remove();
        document.body.classList.remove("page-data-loading");
        document.body.classList.add("page-data-ready");
      }, 260);
    };

    const checkPageReadiness = () => {
      if (dismissed || dismissScheduled) return;
      const allPartsCompleted = [...expectedParts].every((part) =>
        completedParts.has(part),
      );
      const enoughItems =
        minimumReadyItems > 0 &&
        [...completedItemCounts.values()].reduce((sum, count) => sum + count, 0) >=
          minimumReadyItems;
      if (!allPartsCompleted && !enoughItems) return;

      dismissScheduled = true;
      const remainingTime = minimumDisplayTime - (performance.now() - startedAt);
      window.setTimeout(dismissPageLoader, Math.max(0, remainingTime));
    };

    window.addEventListener("page-content-ready", (event) => {
      if (event.detail?.page !== pageName) return;
      const part = event.detail.part;
      if (!expectedParts.has(part)) {
        console.error(`未知的頁面資料載入項目：「${part}」。`);
        return;
      }
      const itemCount = Number(event.detail.items);
      if (!completedParts.has(part) && Number.isFinite(itemCount) && itemCount > 0) {
        completedItemCounts.set(part, itemCount);
      }
      completedParts.add(part);
      checkPageReadiness();
    });

    window.setTimeout(() => {
      if (dismissed) return;
      const message = pageLoader.querySelector("[data-page-loader-message]");
      if (message) message.textContent = "載入時間較長，正在顯示目前可用內容……";
      pageLoader.setAttribute("aria-label", "載入時間較長，正在顯示目前可用內容");
      if (!dismissScheduled) dismissPageLoader();
    }, 12000);
  } else if (document.documentElement.dataset.pageLoaderSeen === "true") {
    pageLoader.remove();
  } else {
    const startedAt = performance.now();
    let dismissed = false;
    const dismissPageLoader = () => {
      if (dismissed) return;
      const remaining = 450 - (performance.now() - startedAt);
      if (remaining > 0) {
        window.setTimeout(dismissPageLoader, remaining);
        return;
      }
      dismissed = true;
      pageLoader.classList.add("is-hidden");
      window.setTimeout(() => {
        pageLoader.remove();
      }, 260);
    };

    if (document.readyState === "complete") {
      dismissPageLoader();
    } else {
      window.addEventListener("load", dismissPageLoader, { once: true });
      window.setTimeout(dismissPageLoader, 6000);
    }
  }
}

const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const themeToggleButtons = [...document.querySelectorAll("[data-theme-toggle]")];
const themePreferenceKey = "hakka-theme";
const hakkaRuntimeSystemThemeQuery = window.matchMedia?.(
  "(prefers-color-scheme: dark)",
);
let registerRevealTargets = () => {};
let finishRevealTarget = (target) => target.classList.remove("is-revealing");

const setTheme = (theme, persist = false) => {
  const isNight = theme === "night";
  document.documentElement.dataset.theme = isNight ? "night" : "day";
  themeToggleButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(isNight));
    button.title = `切換至${isNight ? "日間" : "夜間"}模式`;
    button.querySelector("[data-theme-icon]").textContent = isNight ? "light_mode" : "dark_mode";
    button.querySelector("[data-theme-label]").textContent = isNight ? "日間" : "夜間";
  });
  if (persist) {
    document.documentElement.dataset.themePreference = "user";
    try {
      window.localStorage.setItem(themePreferenceKey, isNight ? "night" : "day");
    } catch (error) {
      console.warn("無法儲存日夜模式偏好。", error);
    }
  }
};

setTheme(document.documentElement.dataset.theme === "night" ? "night" : "day");

themeToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "night" ? "day" : "night", true);
  });
});

const updateThemeFromSystem = (event) => {
  if (document.documentElement.dataset.themePreference === "system") {
    setTheme(event.matches ? "night" : "day");
  }
};
if (typeof hakkaRuntimeSystemThemeQuery?.addEventListener === "function") {
  hakkaRuntimeSystemThemeQuery.addEventListener("change", updateThemeFromSystem);
} else if (typeof hakkaRuntimeSystemThemeQuery?.addListener === "function") {
  hakkaRuntimeSystemThemeQuery.addListener(updateThemeFromSystem);
}

const heroCard = document.querySelector("[data-hero-card]");
if (heroCard) {
  const heroCardViewport = window.matchMedia("(max-width: 700px)");
  const heroCardDialogue = heroCard.querySelector("[data-hero-dialogue]");
  const heroCardMessages = [
    "你在找我嗎？",
    "駭客面板啟動！",
    "需要更多的委託....",
    "更多有趣的Live2D正在前方等著我。",
    "如果發現到什麼有趣的要跟我說喔！",
  ];
  const AudioContextConstructor = window.AudioContext;
  let cardAudioContext;
  let dialogueIndex = 0;
  let dialogueTimer;

  heroCard.disabled = heroCardViewport.matches;
  heroCardViewport.addEventListener("change", (event) => {
    heroCard.disabled = event.matches;
  });

  const playCardChime = () => {
    if (!AudioContextConstructor) {
      console.warn("目前瀏覽器不支援角色卡提示音。");
      return;
    }

    if (!cardAudioContext) {
      try {
        cardAudioContext = new AudioContextConstructor();
      } catch (error) {
        console.warn("無法建立角色卡提示音。", error);
        return;
      }
    }

    const playNotes = () => {
      const startTime = cardAudioContext.currentTime;
      [659.25, 880].forEach((frequency, index) => {
        const noteStart = startTime + index * 0.075;
        const oscillator = cardAudioContext.createOscillator();
        const gain = cardAudioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, noteStart);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.045, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.22);
        oscillator.connect(gain);
        gain.connect(cardAudioContext.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + 0.23);
      });
    };

    if (cardAudioContext.state === "suspended") {
      cardAudioContext
        .resume()
        .then(playNotes)
        .catch((error) => console.warn("無法播放角色卡提示音。", error));
    } else if (cardAudioContext.state === "running") {
      playNotes();
    } else {
      console.warn("角色卡提示音目前無法播放。", cardAudioContext.state);
    }
  };

  heroCard.addEventListener("click", () => {
    if (heroCardViewport.matches) return;

    heroCard.classList.remove("is-bouncing");
    void heroCard.offsetWidth;
    heroCard.classList.add("is-bouncing");

    heroCardDialogue.textContent = heroCardMessages[dialogueIndex];
    dialogueIndex = (dialogueIndex + 1) % heroCardMessages.length;
    heroCardDialogue.classList.add("is-visible");
    clearTimeout(dialogueTimer);
    dialogueTimer = setTimeout(() => {
      heroCardDialogue.classList.remove("is-visible");
    }, 2200);

    playCardChime();
  });
}

const parseCsv = (source) => {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  const csv = source.replace(/^\uFEFF/, "");

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
};

if (menuToggle && siteNav) {
  const mobileMenuQuery = window.matchMedia("(max-width: 700px)");
  let menuCloseTimer;
  siteNav.inert = mobileMenuQuery.matches;

  const setMenuOpen = (open) => {
    window.clearTimeout(menuCloseTimer);
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "關閉導覽選單" : "開啟導覽選單");
    siteNav.classList.toggle("is-open", open);
    const animateClose =
      !open &&
      mobileMenuQuery.matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    siteNav.classList.toggle("is-closing", animateClose);
    siteNav.inert = mobileMenuQuery.matches && !open;

    if (animateClose) {
      menuCloseTimer = window.setTimeout(() => {
        siteNav.classList.remove("is-closing");
      }, 180);
    }
  };

  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    setMenuOpen(!open);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  mobileMenuQuery.addEventListener("change", (event) => {
    window.clearTimeout(menuCloseTimer);
    siteNav.classList.remove("is-open", "is-closing");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "開啟導覽選單");
    siteNav.inert = event.matches;
  });
}

document.querySelectorAll('[role="tablist"]').forEach((tablist) => {
  const tabs = [...tablist.querySelectorAll('[role="tab"][aria-controls]')];
  if (tabs.length === 0) return;

  const panels = [
    ...new Set(tabs.map((tab) => tab.getAttribute("aria-controls"))),
  ]
    .map((panelId) => document.getElementById(panelId))
    .filter(Boolean);
  let selectedTab = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];
  const panelExitTimers = new Map();
  const displayedPanels = new Set([selectedTab.getAttribute("aria-controls")]);

  const selectTab = (tab, { focus = false, animate = true } = {}) => {
    const changed = selectedTab !== tab;
    const previousScrollY = window.scrollY;
    const previousTab = selectedTab;
    const previousPanelId = previousTab?.getAttribute("aria-controls");
    const fadePanels =
      changed &&
      animate &&
      tablist.hasAttribute("data-fade-panels") &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panelFadeDuration = tablist.hasAttribute("data-slow-fade-panels")
      ? 650
      : 360;
    selectedTab = tab;

    const adjustScrollIfClamped = () => {
      if (
        selectedTab !== tab ||
        !tablist.hasAttribute("data-reset-scroll-if-clamped")
      ) {
        return;
      }
      const maxScrollY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      if (
        previousScrollY <= maxScrollY + 1 ||
        window.scrollY < maxScrollY - 1
      ) {
        return;
      }
      const activePanel = panels.find(
        (panel) => panel.id === tab.getAttribute("aria-controls"),
      );
      if (!activePanel) return;
      const panelTop = activePanel.getBoundingClientRect().top + window.scrollY;
      const scrollMarginTop =
        Number.parseFloat(getComputedStyle(activePanel).scrollMarginTop) || 0;
      window.scrollTo({
        top: Math.max(0, panelTop - scrollMarginTop),
        behavior: "instant",
      });
    };

    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel) => {
      const selected = panel.id === tab.getAttribute("aria-controls");
      if (!selected) {
        panel
          .querySelectorAll(".scroll-reveal.is-revealing")
          .forEach(finishRevealTarget);
      }
      if (selected) {
        const exitTimer = panelExitTimers.get(panel);
        if (exitTimer) {
          clearTimeout(exitTimer);
          panelExitTimers.delete(panel);
        }
        panel.hidden = false;
        panel.inert = false;
        panel.removeAttribute("aria-hidden");
        panel.classList.remove("tab-panel-exit");
        panel.setAttribute("aria-labelledby", tab.id);
        if (
          changed &&
          animate &&
          (panels.length === 1 ||
            !displayedPanels.has(panel.id) ||
            tablist.hasAttribute("data-replay-visited-panels"))
        ) {
          panel.classList.remove("tab-panel-enter");
          if (fadePanels) {
            void panel.offsetWidth;
            panel.classList.add("tab-panel-enter");
          } else {
            requestAnimationFrame(() => {
              if (!panel.hidden && selectedTab.getAttribute("aria-controls") === panel.id) {
                panel.classList.add("tab-panel-enter");
              }
            });
          }
        }
        displayedPanels.add(panel.id);
      } else if (fadePanels && panel.id === previousPanelId) {
        panel.hidden = false;
        panel.inert = true;
        panel.setAttribute("aria-hidden", "true");
        panel.classList.remove("tab-panel-enter");
        panel.classList.add("tab-panel-exit");
        const exitTimer = window.setTimeout(() => {
          if (selectedTab.getAttribute("aria-controls") !== panel.id) {
            panel.hidden = true;
            panel.inert = false;
            panel.removeAttribute("aria-hidden");
            panel.classList.remove("tab-panel-exit");
          }
          panelExitTimers.delete(panel);
          adjustScrollIfClamped();
        }, panelFadeDuration);
        panelExitTimers.set(panel, exitTimer);
      } else {
        const exitTimer = panelExitTimers.get(panel);
        if (exitTimer) {
          clearTimeout(exitTimer);
          panelExitTimers.delete(panel);
        }
        panel.hidden = true;
        panel.inert = false;
        panel.removeAttribute("aria-hidden");
        panel.classList.remove("tab-panel-enter");
        panel.classList.remove("tab-panel-exit");
      }
    });

    if (
      changed &&
      !fadePanels &&
      tablist.hasAttribute("data-reset-scroll-if-clamped")
    ) {
      requestAnimationFrame(adjustScrollIfClamped);
    }

    const gallery = tab.dataset.filter
      ? document.getElementById(tab.getAttribute("aria-controls"))
      : null;
    if (gallery) {
      gallery.querySelectorAll(".work-item").forEach((item) => {
        item.hidden = tab.dataset.filter !== "all" && item.dataset.category !== tab.dataset.filter;
      });
    }

    const serviceInput = tab.dataset.serviceValue
      ? document.querySelector(`input[name="service"][value="${tab.dataset.serviceValue}"]`)
      : null;
    if (serviceInput && !serviceInput.checked) {
      serviceInput.checked = true;
      serviceInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (focus) tab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("keydown", (event) => {
      let nextIndex = index;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIndex = (index - 1 + tabs.length) % tabs.length;
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextIndex = (index + 1) % tabs.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }
      event.preventDefault();
      selectTab(tabs[nextIndex], { focus: true });
    });
  });

  selectTab(selectedTab, { animate: false });
});

const commissionStatusMessages = {
  open: { label: "Live2D委託開放中", detail: "" },
  queueing: { label: "排單中", detail: "可承接時程請聯絡確認" },
  paused: { label: "暫停接案", detail: "目前暫停承接新案" },
  full: { label: "額滿", detail: "目前委託額滿" },
  unavailable: { label: "狀態暫時無法取得", detail: "請聯絡確認" },
};
const commissionStatusKeys = {
  "Live2D委託開放中": "open",
  開放洽詢: "open",
  排單中: "queueing",
  暫停接案: "paused",
  額滿: "full",
};

const setCommissionStatus = (state) => {
  const status = commissionStatusMessages[state]
    ? state
    : commissionStatusKeys[state] || "unavailable";
  document.querySelectorAll("[data-commission-status]").forEach((item) => {
    item.dataset.state = status;
    item.querySelector("[data-status-label]").textContent = commissionStatusMessages[status].label;
    const detail = commissionStatusMessages[status].detail;
    const detailElement = item.querySelector("[data-status-detail]");
    detailElement.textContent = detail;
    detailElement.hidden = !detail;
    item.setAttribute(
      "aria-label",
      `目前${commissionStatusMessages[status].label}${detail ? `，${detail}` : ""}${item instanceof HTMLAnchorElement ? "，查看完整排單" : ""}`,
    );
  });
};

window.setCommissionStatus = setCommissionStatus;
const initialStatus = document.querySelector("[data-commission-status]")?.dataset.state;
if (initialStatus) setCommissionStatus(initialStatus);

const commissionStatusElements = document.querySelectorAll("[data-commission-status]");
if (commissionStatusElements.length > 0) {
  const commissionStatusCsvUrl =
    "https://docs.google.com/spreadsheets/d/1D-3fx7SqNWTx_prA4Wd0ricCVnM7Zaox3Br0EWQ7Yfc/export?format=csv&gid=1661631331";

  const loadCommissionStatus = async () => {
    try {
      const response = await fetch(commissionStatusCsvUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`接案狀態試算表回應錯誤：HTTP ${response.status}`);
      }
      const rows = parseCsv(await response.text());
      const header = rows[0]?.[0]?.trim();
      const state = rows.slice(1).map((row) => row[0]?.trim()).find(Boolean);
      if (header !== "接案狀態" || !state || !commissionStatusKeys[state]) {
        throw new Error("接案狀態試算表格式錯誤，請確認 A1 標題與 A2 狀態選項");
      }
      setCommissionStatus(state);
    } catch (error) {
      console.error("無法讀取公開接案狀態。", error);
      setCommissionStatus("unavailable");
    }
  };

  loadCommissionStatus();
}

const twitchLiveStatus = document.querySelector("[data-twitch-status]");
if (twitchLiveStatus) {
  const endpoint = twitchLiveStatus.dataset.endpoint?.trim();
  const statusLabel = twitchLiveStatus.querySelector("[data-twitch-status-label]");
  const twitchLogin = "hakkanekolive2d";

  const renderTwitchStatus = (state, label) => {
    twitchLiveStatus.dataset.state = state;
    statusLabel.textContent = label;
    twitchLiveStatus.setAttribute("aria-label", `Twitch 直播狀態：${label}`);
  };

  const checkPublicTwitchStatus = async () => {
    try {
      const response = await fetch(
        `https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(twitchLogin)}`,
        { cache: "no-store", signal: window.createHakkaTimeoutSignal(8000) },
      );
      if (!response.ok) {
        throw new Error(`IVR 狀態服務回應錯誤：HTTP ${response.status}`);
      }
      const users = await response.json();
      const user = Array.isArray(users)
        ? users.find((entry) => entry.login?.toLowerCase() === twitchLogin)
        : null;
      if (user && Object.hasOwn(user, "stream")) {
        return user.stream ? "online" : "offline";
      }
      throw new Error(`IVR 狀態服務找不到 Twitch 頻道：${twitchLogin}`);
    } catch (ivrError) {
      try {
        const response = await fetch(
          `https://decapi.me/twitch/uptime/${encodeURIComponent(twitchLogin)}`,
          { cache: "no-store", signal: window.createHakkaTimeoutSignal(5000) },
        );
        if (!response.ok) {
          throw new Error(`Decapi 狀態服務回應錯誤：HTTP ${response.status}`);
        }
        const uptime = (await response.text()).trim();
        if (/\boffline\b/i.test(uptime)) return "offline";
        if (/\b\d+\s*(second|minute|hour|day)s?\b/i.test(uptime)) return "online";
        throw new Error(`Decapi 回傳無法判讀的 Twitch 狀態：${uptime || "(空白)"}`);
      } catch (decapiError) {
        console.warn(`無法查詢 Twitch 頻道「${twitchLogin}」的直播狀態。`, {
          ivrError,
          decapiError,
        });
        return "unknown";
      }
    }
  };

  const loadTwitchStatus = async () => {
    if (!endpoint) {
      const state = await checkPublicTwitchStatus();
      const label =
        state === "unknown" ? "狀態未知" : state === "online" ? "直播中" : "未直播";
      renderTwitchStatus(state === "unknown" ? "error" : state, label);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Twitch 狀態服務回應錯誤：HTTP ${response.status}`);
      }
      const result = await response.json();
      if (result.channel !== "hakkanekolive2d" || typeof result.online !== "boolean") {
        throw new Error("Twitch 狀態服務回傳的資料格式無效。");
      }
      renderTwitchStatus(result.online ? "online" : "offline", result.online ? "直播中" : "未直播");
    } catch (error) {
      if (error.name === "AbortError") {
        console.warn("Twitch 直播狀態查詢逾時。");
        renderTwitchStatus("error", "連線較慢");
      } else {
        console.error("無法讀取 Twitch 直播狀態。", error);
        renderTwitchStatus("error", "狀態未知");
      }
    } finally {
      window.clearTimeout(timeoutId);
    };
  };

  loadTwitchStatus();
  window.setInterval(loadTwitchStatus, 5 * 60 * 1000);
}

const scheduleList = document.querySelector("#schedule-list");
if (scheduleList) {
  const scheduleCsvUrl =
    "https://docs.google.com/spreadsheets/d/1D-3fx7SqNWTx_prA4Wd0ricCVnM7Zaox3Br0EWQ7Yfc/export?format=csv";
  const scheduleUpdated = document.querySelector("#schedule-updated");
  const scheduleFilters = [...document.querySelectorAll("[data-schedule-filter]")];
  let scheduleRecords = [];
  let currentScheduleFilter = "all";

  const showScheduleMessage = (message, withContactLink = false) => {
    const container = document.createElement("div");
    container.className = "schedule-message";
    const text = document.createElement("p");
    text.textContent = message;
    container.append(text);
    if (withContactLink) {
      const link = document.createElement("a");
      link.href = "mailto:n47993802@gmail.com";
      link.textContent = "透過 Email 聯絡";
      container.append(link);
    }
    scheduleList.replaceChildren(container);
  };

  const appendDetail = (list, label, value) => {
    if (!value) return;
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    item.append(term, detail);
    list.append(item);
  };

  const makeScheduleCard = (record) => {
    const card = document.createElement("article");
    card.className = "schedule-card";
    card.dataset.progress = record.progress;

    const header = document.createElement("div");
    header.className = "schedule-card-top";
    const client = document.createElement("div");
    const name = document.createElement("strong");
    name.className = "schedule-client";
    name.textContent = record.client || "委託者";
    client.append(name);
    if (record.orderId) {
      const order = document.createElement("span");
      order.className = "schedule-order";
      order.textContent = `委託編號：${record.orderId}`;
      client.append(order);
    }

    const progress = document.createElement("span");
    progress.className = "progress-badge";
    progress.dataset.progress = record.progress;
    progress.textContent = record.progress || "進度待更新";
    header.append(client, progress);

    const item = document.createElement("h3");
    item.textContent = record.item || "委託品項待更新";
    const dates = document.createElement("dl");
    dates.className = "schedule-dates";
    appendDetail(dates, "完成日期", record.completedDate);
    appendDetail(dates, "截止日期", record.deadline);

    card.append(header, item);
    if (dates.childElementCount > 0) card.append(dates);
    if (record.note) {
      const note = document.createElement("p");
      note.className = "schedule-note";
      note.textContent = `備註｜${record.note}`;
      card.append(note);
    }
    return card;
  };

  const renderSchedule = () => {
    const visibleRecords = scheduleRecords.filter((record) => {
      if (currentScheduleFilter === "completed") return record.progress === "已完成";
      if (currentScheduleFilter === "active") return record.progress !== "已完成";
      return true;
    });
    if (visibleRecords.length === 0) {
      showScheduleMessage("這個進度分類目前沒有案件。");
      return;
    }

    const fragment = document.createDocumentFragment();
    const statusGroups = currentScheduleFilter === "all"
      ? [
          { completed: false, records: visibleRecords.filter((record) => record.progress !== "已完成") },
          { completed: true, records: visibleRecords.filter((record) => record.progress === "已完成") },
        ].filter((group) => group.records.length > 0)
      : [{ completed: currentScheduleFilter === "completed", records: visibleRecords }];

    statusGroups.forEach(({ completed, records: statusRecords }) => {
      const monthGroups = new Map();
      statusRecords.forEach((record) => {
        if (!monthGroups.has(record.month)) monthGroups.set(record.month, []);
        monthGroups.get(record.month).push(record);
      });

      monthGroups.forEach((records, month) => {
        const section = document.createElement("section");
        section.className = "schedule-month";
        const heading = document.createElement("div");
        heading.className = "schedule-month-heading";
        const title = document.createElement("h2");
        title.textContent = `${month || "月份未標示"}${currentScheduleFilter === "all" && completed ? "・已完成" : ""}`;
        const count = document.createElement("span");
        count.textContent = `${records.length} 件委託`;
        const cards = document.createElement("div");
        cards.className = "schedule-cards";
        records.forEach((record) => cards.append(makeScheduleCard(record)));
        heading.append(title, count);
        section.append(heading, cards);
        fragment.append(section);
      });
    });
    scheduleList.replaceChildren(fragment);
    registerRevealTargets(scheduleList.querySelectorAll(".schedule-card"));
  };

  const updateScheduleCounts = () => {
    const completed = scheduleRecords.filter((record) => record.progress === "已完成").length;
    const counts = {
      all: scheduleRecords.length,
      active: scheduleRecords.length - completed,
      completed,
    };
    Object.entries(counts).forEach(([filter, count]) => {
      const node = document.querySelector(`[data-count="${filter}"]`);
      if (node) node.textContent = String(count);
    });
  };

  scheduleFilters.forEach((button) => {
    button.addEventListener("click", () => {
      currentScheduleFilter = button.dataset.scheduleFilter;
      scheduleFilters.forEach((filterButton) => {
        const active = filterButton === button;
        filterButton.classList.toggle("active", active);
        filterButton.setAttribute("aria-pressed", String(active));
      });
      renderSchedule();
    });
  });

  const loadSchedule = async () => {
    scheduleList.setAttribute("aria-busy", "true");
    try {
      const response = await fetch(scheduleCsvUrl, {
        cache: "no-store",
        signal: window.createHakkaTimeoutSignal(10000),
      });
      if (!response.ok) {
        throw new Error(`排單試算表回應錯誤：HTTP ${response.status}`);
      }
      const rows = parseCsv(await response.text());
      const headers = rows.shift()?.map((header) =>
        header.trim().replace(/\([^)]*\)$/, ""),
      );
      if (!headers?.includes("月份") || !headers.includes("排單進度")) {
        throw new Error("排單試算表缺少必要欄位：月份或排單進度");
      }
      const column = Object.fromEntries(headers.map((header, index) => [header, index]));
      const getValue = (row, key) => {
        const position = column[key];
        return position === undefined ? "" : (row[position] || "").trim();
      };
      scheduleRecords = rows
        .filter((row) => row.some((cell) => cell.trim()))
        .map((row) => ({
          month: getValue(row, "月份"),
          client: getValue(row, "委託者稱呼"),
          orderId: getValue(row, "委託編號"),
          item: getValue(row, "委託品項"),
          progress: getValue(row, "排單進度"),
          completedDate: getValue(row, "完成日期"),
          deadline: getValue(row, "截止日期"),
          note: getValue(row, "備註"),
        }));
      updateScheduleCounts();
      renderSchedule();
      scheduleUpdated.textContent = `已連線・讀取時間 ${new Intl.DateTimeFormat("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date())}`;
    } catch (error) {
      console.error("無法讀取公開排單試算表。", error);
      scheduleUpdated.textContent = "排單資訊暫時無法取得";
      showScheduleMessage("目前無法載入排單資訊，請聯絡確認。", true);
    } finally {
      scheduleList.setAttribute("aria-busy", "false");
    }
  };

  loadSchedule().finally(() => {
    window.dispatchEvent(
      new CustomEvent("page-content-ready", {
        detail: { page: "schedule", part: "schedule", items: scheduleRecords.length },
      }),
    );
  });
}

document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});

if (
  "IntersectionObserver" in window &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  const pendingRevealTargets = new Set();
  const revealFinishers = new WeakMap();
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const target = entry.target;
        if (entry.isIntersecting) {
          pendingRevealTargets.delete(target);
          if (target.classList.contains("is-revealed")) {
            revealObserver.unobserve(target);
            return;
          }
          finishRevealTarget(target);
          const finish = (event) => {
            if (event && event.target !== target) return;
            target.removeEventListener("animationend", finish);
            target.removeEventListener("animationcancel", finish);
            revealFinishers.delete(target);
            target.classList.remove("is-revealing");
          };
          revealFinishers.set(target, finish);
          target.addEventListener("animationend", finish);
          target.addEventListener("animationcancel", finish);
          target.classList.add("is-revealing", "is-revealed");
          revealObserver.unobserve(target);
        } else {
          pendingRevealTargets.add(target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
  );

  finishRevealTarget = (target) => {
    const finish = revealFinishers.get(target);
    if (finish) finish();
    else target.classList.remove("is-revealing");
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    pendingRevealTargets.forEach((target) => {
      if (!target.isConnected) {
        pendingRevealTargets.delete(target);
        return;
      }
      revealObserver.unobserve(target);
      revealObserver.observe(target);
    });
  });

  registerRevealTargets = (targets) => {
    [...targets].forEach((target, index) => {
    if (target.classList.contains("scroll-reveal")) return;
    target.classList.add("scroll-reveal");
    target.style.setProperty("--reveal-delay", `${Math.min(index, 4) * 80}ms`);
    pendingRevealTargets.add(target);
    revealObserver.observe(target);
    });
  };
  registerRevealTargets(
    document.querySelectorAll(
      ".featured-card, .work-item, .recommend-card, .channel-card, .fanart-character-intro-heading, .fanart-character-card, .fanart-card, .artist-card, .schedule-card, .action-card, .summary-card, .choice-card",
    ),
  );
}

const calculator = document.querySelector("#commission-calculator");
if (calculator) {
  const summaryList = document.querySelector("#summary-list");
  const commissionIdElement = document.querySelector("#commission-id");
  const summaryTotalLabel = document.querySelector("#summary-total-label");
  const summaryTotal = document.querySelector("#summary-total");
  const summaryTotalAnnouncement = document.querySelector(
    "#summary-total-announcement",
  );
  const summaryNote = document.querySelector("#summary-note");
  const quoteStatus = document.querySelector("#quote-status");
  const downloadButton = document.querySelector("#download-quote");
  const modelPanel = document.querySelector("#model-options");
  const modelPlanPanel = document.querySelector("#model-plan-options");
  const modelExtraPanel = document.querySelector("#model-extra-options");
  const autoAdditionsToast = document.querySelector("[data-auto-additions-toast]");
  const autoAdditionsNote = calculator.querySelector("[data-auto-additions-note]");
  const animationPanel = document.querySelector("#animation-options");
  const animationDetailPanel = document.querySelector("#animation-detail-options");
  const paymentOptions = calculator.querySelector("[data-payment-options]");
  const rushDateField = document.querySelector("[data-rush-date-field]");
  const modelPlanOptions = [...calculator.querySelectorAll("[data-model-plan-option]")];
  const animationTypePanels = [...calculator.querySelectorAll("[data-animation-panel]")];
  const quantityInputs = [...calculator.querySelectorAll("[data-model-quantity]")];
  const manualModelInputs = [...calculator.querySelectorAll("[data-manual-model-option]")];
  const modelAddonInputs = [...calculator.querySelectorAll("[data-model-addon]")];
  const modelPricing = {
    simplified: {
      label: "吉祥物型",
      plans: { standard: 500 },
      quantities: {
        expressions: 80,
        hairstyles: 50,
        outfits: 100,
        accessories: 40,
        gestures: 80,
        effects: 100,
      },
      addons: { tongue: 50, animalEars: 50, tail: 50, trackingLoss: 100 },
    },
    chibi: {
      label: "Q 版角色",
      plans: { standard: 1500, professional: 3500, top: 6000 },
      quantities: {
        expressions: 150,
        hairstyles: 250,
        outfits: 1500,
        accessories: 100,
        gestures: 750,
        effects: 200,
      },
      addons: {
        tongue: 700,
        animalEars: 600,
        tail: 300,
        aiueo: 600,
        trackingLoss: 400,
        vbridger: 2500,
      },
    },
    proportionate: {
      label: "正比人物",
      plans: { standard: 12000, professional: 18000, top: 25000 },
      quantities: {
        expressions: 250,
        hairstyles: 1500,
        outfits: 2500,
        accessories: 150,
        gestures: 1800,
        effects: 250,
      },
      addons: {
        tongue: 1000,
        animalEars: 1000,
        tail: 500,
        aiueo: 800,
        trackingLoss: 600,
        chibiConversion: 4000,
        vbridger: 4000,
      },
    },
  };
  const modelQuantityLabels = {
    expressions: { label: "表情拆分", unit: "個" },
    hairstyles: { label: "髮型拆分", unit: "個" },
    outfits: { label: "服裝", unit: "套" },
    accessories: { label: "配件", unit: "個" },
    gestures: { label: "手勢動畫", unit: "項" },
    effects: { label: "特效動畫", unit: "項" },
  };
  const modelAddonLabels = {
    tongue: "吐舌",
    animalEars: "獸耳",
    tail: "尾巴",
    aiueo: "AIUEO 口型",
    trackingLoss: "追蹤丟失動畫",
    chibiConversion: "Q 版化",
    vbridger: "VBridger 相容",
  };
  const getTopPlanFreeAddons = (modelType, modelPlan) => {
    if (modelPlan !== "top") return [];
    const pricing = modelPricing[modelType];
    return ["aiueo", "trackingLoss"].filter((key) => typeof pricing?.addons[key] === "number");
  };
  let autoAdditionsToastTimer = 0;
  let autoAdditionsToastHideTimer = 0;
  const hideAutoAdditionsToast = () => {
    window.clearTimeout(autoAdditionsToastTimer);
    window.clearTimeout(autoAdditionsToastHideTimer);
    if (autoAdditionsToast.hidden) return;
    autoAdditionsToast.classList.remove("is-visible");
    autoAdditionsToastHideTimer = window.setTimeout(() => {
      autoAdditionsToast.hidden = true;
    }, 420);
  };
  const showAutoAdditionsToast = (includedAddons) => {
    window.clearTimeout(autoAdditionsToastTimer);
    window.clearTimeout(autoAdditionsToastHideTimer);
    autoAdditionsToast.textContent =
      `頂級方案已自動加入 ${includedAddons.map((key) => modelAddonLabels[key]).join("、")} 至需求摘要（免費）。`;
    autoAdditionsToast.hidden = false;
    autoAdditionsToast.classList.remove("is-visible");
    window.requestAnimationFrame(() => {
      if (!autoAdditionsToast.hidden) autoAdditionsToast.classList.add("is-visible");
    });
    autoAdditionsToastTimer = window.setTimeout(() => {
      autoAdditionsToast.classList.remove("is-visible");
      autoAdditionsToastHideTimer = window.setTimeout(() => {
        autoAdditionsToast.hidden = true;
      }, 420);
    }, 3200);
  };
  const modelPlanLabels = {
    standard: "標準",
    professional: "專業",
    top: "頂級",
  };
  const paymentMethodRates = { bank: 0, paypal: 0.05, ecpay: 0.029 };
  const paymentMethodLabels = {
    bank: "銀行匯款",
    paypal: "PayPal（5%）",
    ecpay: "綠界／超商（2.9%）",
  };
  const paymentPlanRates = { full: 0, two: 0.03, three: 0.05 };
  const paymentPlanLabels = {
    full: "一次付清",
    two: "兩期分款（50%／50%，+3%）",
    three: "三期付款（各 1/3，+5%）",
  };
  let currentQuote = null;
  let commissionCreatedAt = null;
  let summaryAnimationFrame = 0;
  let summaryUpdateTimeout;

  const selectedValue = (name) =>
    calculator.querySelector(`input[name="${name}"]:checked`)?.value || "";
  const readText = (selector) => calculator.querySelector(selector)?.value.trim() || "";
  const readWholeNumber = (input) => {
    const rawValue = input.value.trim();
    const value = Number(rawValue);
    const minimum = Number(input.min || 0);
    return rawValue && Number.isInteger(value) && value >= minimum ? value : null;
  };
  const formatPrice = (amount) => `NT$${Math.round(amount).toLocaleString("zh-TW")}`;
  const parseSummaryAmount = (text) => {
    const match = text.match(/^NT\$([\d,]+) 起$/);
    return match ? Number(match[1].replace(/,/g, "")) : null;
  };
  const revealTransitions = new WeakMap();
  const setRevealVisibility = (element, visible) => {
    const currentTransition = revealTransitions.get(element);
    if (
      currentTransition?.visible === visible ||
      (!currentTransition && element.hidden === !visible)
    ) {
      return;
    }

    const wasHidden = element.hidden;
    const computedStyle = getComputedStyle(element);
    const startHeight = wasHidden ? 0 : element.getBoundingClientRect().height;
    const startOpacity = wasHidden ? 0 : Number.parseFloat(computedStyle.opacity);
    const startTransform = wasHidden ? "translateY(-8px)" : computedStyle.transform;
    currentTransition?.animation.cancel();

    element.hidden = false;
    element.inert = true;
    element.setAttribute("aria-hidden", "true");
    const endHeight = visible ? element.getBoundingClientRect().height : 0;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.hidden = !visible;
      element.inert = false;
      element.removeAttribute("aria-hidden");
      element.style.removeProperty("overflow");
      revealTransitions.delete(element);
      return;
    }

    element.style.overflow = "hidden";
    const animation = element.animate(
      [
        {
          height: `${startHeight}px`,
          opacity: startOpacity,
          transform: startTransform,
        },
        {
          height: `${endHeight}px`,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-8px)",
        },
      ],
      { duration: 340, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
    const transition = { visible, animation };
    revealTransitions.set(element, transition);
    animation.onfinish = () => {
      if (revealTransitions.get(element) !== transition) return;
      element.hidden = !visible;
      element.inert = false;
      element.removeAttribute("aria-hidden");
      element.style.removeProperty("overflow");
      revealTransitions.delete(element);
      animation.cancel();
    };
  };
  const createCommissionId = (service) => {
    if (!service) return "";
    if (!commissionCreatedAt) commissionCreatedAt = new Date();

    const pad = (value) => String(value).padStart(2, "0");
    const prefix = service === "model" ? "VP" : "AN";
    const date = commissionCreatedAt;
    return `${prefix}-${date.getFullYear()}-${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  };

  const updateVisiblePanels = () => {
    const service = selectedValue("service");
    const modelType = selectedValue("model-type");
    const animationType = selectedValue("animation-type");
    modelPanel.hidden = service !== "model";
    setRevealVisibility(modelExtraPanel, service === "model" && Boolean(modelType));
    animationPanel.hidden = service !== "animation";
    setRevealVisibility(
      animationDetailPanel,
      service === "animation" && Boolean(animationType),
    );
    setRevealVisibility(
      paymentOptions,
      service === "model" ? Boolean(modelType) : Boolean(animationType),
    );

    setRevealVisibility(modelPlanPanel, Boolean(modelType));
    const modelPlan = selectedValue("model-plan");
    const pricing = modelPricing[modelType];
    const autoIncludedAddons = getTopPlanFreeAddons(modelType, modelPlan);
    autoAdditionsNote.hidden = autoIncludedAddons.length === 0;
    modelPlanOptions.forEach((option) => {
      const planInput = option.querySelector('input[name="model-plan"]');
      const available = modelType !== "simplified" || planInput.value === "standard";
      option.hidden = !available;
      planInput.disabled = !available;
      if (!available && planInput.checked) {
        calculator.querySelector('input[name="model-plan"][value="standard"]').checked = true;
      }
      const price = pricing?.plans[planInput.value];
      option.querySelector("[data-model-plan-price]").textContent =
        typeof price === "number" ? formatPrice(price) : "—";
      const comparisonPrice = calculator.querySelector(
        `[data-plan-comparison-price="${planInput.value}"]`,
      );
      comparisonPrice.textContent =
        typeof price === "number" ? formatPrice(price) : pricing ? "不適用" : "—";
    });

    quantityInputs.forEach((input) => {
      const key = input.dataset.modelQuantity;
      const price = pricing?.quantities[key];
      const priceLabel = input.closest(".quantity-option").querySelector("[data-model-quantity-price]");
      const isIncluded =
        key === "accessories" && modelPlan === "top" && modelType !== "simplified";
      priceLabel.textContent = isIncluded
        ? "頂級方案免費"
        : typeof price === "number"
          ? `${formatPrice(price)}／${modelQuantityLabels[key].unit}`
          : "—";
    });

    modelAddonInputs.forEach((input) => {
      const option = input.closest(".toggle-option");
      const priceLabel = option.querySelector("[data-model-addon-price]");
      const price = pricing?.addons[input.dataset.modelAddon];
      const available = typeof price === "number";
      const planAvailable = !input.dataset.requiresPlan || input.dataset.requiresPlan === modelPlan;
      const isIncluded = autoIncludedAddons.includes(input.dataset.modelAddon);
      option.hidden = !available || isIncluded;
      input.disabled = !available || !planAvailable || isIncluded;
      if (!available || !planAvailable || isIncluded) input.checked = false;
      option.classList.toggle("is-disabled", available && !planAvailable);
      priceLabel.textContent = !available || isIncluded
        ? ""
        : planAvailable
          ? formatPrice(price)
          : "需選擇頂級";
    });

    const firstPaymentSection = service === "animation" ? 3 : 5;
    calculator.querySelectorAll("[data-section-number]").forEach((indicator, index) => {
      indicator.textContent = String(firstPaymentSection + index).padStart(2, "0");
    });
    animationTypePanels.forEach((panel) => {
      setRevealVisibility(panel, panel.dataset.animationPanel === animationType);
    });

    const rushInput = calculator.querySelector("[data-rush]");
    rushDateField.hidden = !rushInput.checked;
  };

  const validateVisibleNumbers = () => {
    const visibleNumbers = [...calculator.querySelectorAll('input[type="number"]')].filter(
      (input) => !input.closest("[hidden]"),
    );
    const invalidInputs = [];

    visibleNumbers.forEach((input) => {
      const value = Number(input.value);
      const minimum = Number(input.min || 0);
      if (!input.value.trim() || !Number.isInteger(value) || value < minimum) {
        input.setAttribute("aria-invalid", "true");
        invalidInputs.push(input.getAttribute("aria-label") || input.labels?.[0]?.textContent.trim() || "數量欄位");
      } else {
        input.removeAttribute("aria-invalid");
      }
    });

    return invalidInputs;
  };

  const renderSummary = () => {
    updateVisiblePanels();
    const invalidInputs = validateVisibleNumbers();
    const service = selectedValue("service");
    const requestId = createCommissionId(service);
    commissionIdElement.textContent = requestId || "選擇服務後產生";
    const rows = [];
    const addRow = (label, value) => rows.push({ label, value });
    let subtotal = 0;
    let hasKnownBase = false;
    let requiresManualQuote = false;
    let selectedServiceName = "";

    if (service === "model") {
      selectedServiceName = "VTube 可操控模型";
      addRow("服務", selectedServiceName);
      const modelType = selectedValue("model-type");
      const modelPlan = selectedValue("model-plan");
      if (!modelType) {
        addRow("模型類型", "尚未選擇");
      } else {
        const pricing = modelPricing[modelType];
        addRow("模型類型", pricing.label);
        addRow("建模方案", modelPlanLabels[modelPlan]);
        const planPrice = pricing.plans[modelPlan];
        if (typeof planPrice === "number") {
          subtotal += planPrice;
          hasKnownBase = true;
          addRow(`${modelPlanLabels[modelPlan]}方案價格`, formatPrice(planPrice));
        }
      }

      quantityInputs.forEach((input) => {
        const quantity = Number(input.value);
        if (!Number.isInteger(quantity) || quantity <= 0) return;
        const key = input.dataset.modelQuantity;
        const item = modelQuantityLabels[key];
        const isIncluded =
          key === "accessories" && modelPlan === "top" && modelType !== "simplified";
        const price = modelPricing[modelType]?.quantities[key];
        if (typeof price !== "number") return;
        const amount = isIncluded ? 0 : quantity * price;
        subtotal += amount;
        addRow(
          `${item.label}（${quantity}${item.unit}）`,
          isIncluded ? "已包含於頂級方案" : formatPrice(amount),
        );
      });

      getTopPlanFreeAddons(modelType, modelPlan).forEach((key) => {
        addRow(modelAddonLabels[key], "已自動加入（頂級方案免費）");
      });

      modelAddonInputs
        .filter((input) => input.checked && !input.disabled)
        .forEach((input) => {
          const key = input.dataset.modelAddon;
          const price = modelPricing[modelType]?.addons[key];
          if (typeof price !== "number") return;
          subtotal += price;
          addRow(modelAddonLabels[key], formatPrice(price));
      });

      manualModelInputs
        .filter((input) => input.checked)
        .forEach((input) => {
          addRow(input.value, "需另外提出");
          requiresManualQuote = true;
        });
    } else if (service === "animation") {
      selectedServiceName = "Live2D 動畫";
      addRow("服務", selectedServiceName);
      const animationType = selectedValue("animation-type");
      if (!animationType) {
        addRow("動畫類型", "尚未選擇");
      } else if (animationType === "short") {
        const quantity = readWholeNumber(calculator.querySelector("[data-short-quantity]"));
        const duration = readWholeNumber(calculator.querySelector("[data-short-duration]"));
        subtotal = (quantity || 0) * 500;
        hasKnownBase = true;
        addRow("動畫類型", "短版動態素材（貼圖／Logo／短循環）");
        addRow("委託件數", quantity === null ? "請填寫有效件數" : `${quantity} 件`);
        addRow("每件動態時間", duration === null ? "請填寫有效秒數" : `${duration} 秒`);
        addRow(
          "循環播放",
          calculator.querySelector("[data-short-loop]").checked ? "需要（已含於起價）" : "不需要",
        );
        if (quantity !== null) addRow("短版素材起價", `${formatPrice(500)} × ${quantity} 件`);
        if (duration !== null && duration > 3) {
          addRow("超過 3 秒", "增加費用依內容另估");
          requiresManualQuote = true;
        }
      } else if (animationType === "scene") {
        const duration = readWholeNumber(calculator.querySelector("[data-scene-duration]"));
        const characters = readWholeNumber(calculator.querySelector("[data-scene-characters]"));
        const detail = readText("[data-scene-detail]");
        const performance = readText("[data-scene-performance]");
        const background = readText("[data-scene-background]");
        subtotal = 2000;
        hasKnownBase = true;
        addRow("動畫類型", "場景／影片型動畫");
        addRow("動態時間", duration === null ? "請填寫有效秒數" : `${duration} 秒`);
        addRow("人物數量", characters === null ? "請填寫有效人數" : `${characters} 位`);
        addRow("基準內容", "5 秒、1 位人物、單一循環動作、靜態背景");
        if (detail) addRow("作品精緻度", detail);
        if (performance) addRow("表演設計", performance);
        if (background) addRow("背景動態需求", background);
        addRow("場景／影片型起價", formatPrice(2000));
        if (duration !== null && duration > 5) {
          addRow("超過 5 秒", "增加費用依內容另估");
          requiresManualQuote = true;
        }
        if (characters !== null && characters > 1) {
          addRow("額外人物", "依人物複雜度個別報價");
          requiresManualQuote = true;
        }
        if (detail || performance || background) requiresManualQuote = true;
      }
    }

    if (service) {
      addRow("付款方式", paymentMethodLabels[selectedValue("payment-method")]);
      addRow("付款期數", paymentPlanLabels[selectedValue("payment-plan")]);
    }

    const rush = calculator.querySelector("[data-rush]").checked;
    const desiredDate = readText("[data-rush-date]");
    if (rush) {
      addRow(
        "加急需求",
        desiredDate
          ? `希望於 ${desiredDate} 前交付（需求日期非確認交期；實際時程與報價待確認）`
          : "加急需求，實際時程與報價待確認",
      );
      requiresManualQuote = true;
    }
    const notes = readText("[data-extra-notes]");
    if (notes) addRow("補充資訊", notes);

    const paymentRate = paymentMethodRates[selectedValue("payment-method")] || 0;
    const installmentRate = paymentPlanRates[selectedValue("payment-plan")] || 0;
    let paymentFees = 0;
    if (hasKnownBase && invalidInputs.length === 0) {
      if (paymentRate > 0) {
        const fee = Math.round(subtotal * paymentRate);
        paymentFees += fee;
        addRow("付款平台手續費", `${formatPrice(fee)}（按已知起價計 ${(paymentRate * 100).toFixed(1)}%）`);
      }
      if (installmentRate > 0) {
        const fee = Math.round(subtotal * installmentRate);
        paymentFees += fee;
        addRow("分期手續費", `${formatPrice(fee)}（按已知起價計 ${(installmentRate * 100).toFixed(1)}%）`);
      }
    }

    const knownTotal = subtotal + paymentFees;
    let totalText = "先選擇服務類型";
    let totalLabel = "初步起價";
    let noteText = "初步估價僅供參考，正式報價依素材與需求確認。";
    if (service === "model" && !selectedValue("model-type")) {
      totalText = "先選擇角色類型";
    } else if (service === "animation" && !selectedValue("animation-type")) {
      totalText = "先選擇動畫類型";
      noteText = "請先選擇動畫類型並填寫需求，查看初步估價。";
    } else if (hasKnownBase) {
      totalText = `${formatPrice(knownTotal)} 起`;
      if (requiresManualQuote) {
        totalLabel = "目前可計算起價";
        noteText =
          "此為已列項目起價，其他需求另行報價。";
      } else if (service === "model") {
        noteText = "最終價格依 PSD 與可動物件確認。";
      } else {
        noteText = "超出基準內容的需求將另行估價。";
      }
      if (paymentFees > 0) {
        noteText += " 手續費依正式報價計算。";
      }
    }

    if (invalidInputs.length > 0) {
      totalLabel = "尚無法初估";
      totalText = "請檢查數量或秒數";
      noteText = `請輸入有效的整數數量或秒數：${invalidInputs.join("、")}`;
    }

    if (notes) noteText += " 補充需求已列入摘要。";
    summaryList.replaceChildren(
      ...rows.map(({ label, value }) => {
        const row = document.createElement("li");
        const name = document.createElement("span");
        const detail = document.createElement("span");
        name.textContent = label;
        detail.textContent = value;
        row.append(name, detail);
        return row;
      }),
    );
    summaryTotalLabel.textContent = totalLabel;
    const previousTotal = currentQuote?.totalText ?? summaryTotal.textContent;
    const previousAmount = parseSummaryAmount(summaryTotal.textContent);
    const nextAmount = parseSummaryAmount(totalText);
    if (
      !currentQuote ||
      currentQuote.totalText !== totalText ||
      currentQuote.totalLabel !== totalLabel
    ) {
      summaryTotalAnnouncement.textContent = `${totalLabel}：${totalText}`;
    }
    if (currentQuote && previousTotal !== totalText) {
      window.cancelAnimationFrame(summaryAnimationFrame);
      window.clearTimeout(summaryUpdateTimeout);
      summaryTotal.classList.remove("is-updating");
      summaryTotal.classList.add("is-updating");

      if (
        previousAmount === null ||
        nextAmount === null ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        summaryTotal.textContent = totalText;
      } else {
        const startTime = performance.now();
        const duration = 560;
        const updateAmount = (now) => {
          const progress = Math.min((now - startTime) / duration, 1);
          const amount = Math.round(
            previousAmount + (nextAmount - previousAmount) * progress,
          );
          summaryTotal.textContent = `${formatPrice(amount)} 起`;
          if (progress < 1) {
            summaryAnimationFrame = window.requestAnimationFrame(updateAmount);
          } else {
            summaryTotal.textContent = totalText;
            summaryAnimationFrame = 0;
          }
        };
        summaryAnimationFrame = window.requestAnimationFrame(updateAmount);
      }

      summaryUpdateTimeout = window.setTimeout(
        () => summaryTotal.classList.remove("is-updating"),
        700,
      );
    } else if (!currentQuote) {
      summaryTotal.textContent = totalText;
    }
    summaryNote.textContent = noteText;

    if (invalidInputs.length > 0) {
      quoteStatus.textContent = `請檢查數量欄位：${invalidInputs.join("、")}`;
      downloadButton.disabled = true;
    } else {
      quoteStatus.textContent = "";
      downloadButton.disabled =
        !service ||
        (service === "model" && !selectedValue("model-type")) ||
        (service === "animation" && !selectedValue("animation-type"));
    }

    currentQuote = {
      rows,
      totalLabel,
      totalText,
      noteText,
      requiresManualQuote,
      requestId,
      date: new Intl.DateTimeFormat("zh-TW").format(new Date()),
    };
  };

  const wrapQuoteLine = (text, maxLength = 44) => {
    const characters = Array.from(text);
    const lines = [];
    while (characters.length > maxLength) {
      lines.push(characters.splice(0, maxLength).join(""));
    }
    if (characters.length > 0) lines.push(characters.join(""));
    return lines;
  };

  const escapeXml = (text) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const createQuoteSvg = (quote) => {
    const detailLines = quote.rows.flatMap(({ label, value }) =>
      wrapQuoteLine(`${label}：${value}`),
    );
    const theme = getComputedStyle(document.documentElement);
    const colors = {
      background: theme.getPropertyValue("--paper").trim(),
      card: theme.getPropertyValue("--surface").trim(),
      panel: theme.getPropertyValue("--surface-soft").trim(),
      text: theme.getPropertyValue("--ink").trim(),
      secondaryText: theme.getPropertyValue("--text-soft").trim(),
      mutedText: theme.getPropertyValue("--muted").trim(),
      accent: theme.getPropertyValue("--accent").trim(),
    };
    const noteLines = wrapQuoteLine(quote.noteText, 54);
    const width = 1080;
    const detailLineHeight = 34;
    const noteLineHeight = 30;
    const detailTop = 246;
    const totalTop = detailTop + detailLines.length * detailLineHeight + 30;
    const noteTop = totalTop + 125;
    const height = noteTop + noteLines.length * noteLineHeight + 100;
    const detailMarkup = detailLines
      .map(
        (line, index) =>
          `<text x="76" y="${detailTop + index * detailLineHeight}" font-size="22" fill="${colors.text}">${escapeXml(line)}</text>`,
      )
      .join("");
    const noteMarkup = noteLines
      .map(
        (line, index) =>
          `<text x="76" y="${noteTop + index * noteLineHeight}" font-size="17" fill="${colors.secondaryText}">${escapeXml(line)}</text>`,
      )
      .join("");

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${colors.background}"/>
      <rect x="28" y="28" width="1024" height="${height - 56}" rx="24" fill="${colors.card}"/>
      <text x="76" y="92" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" font-size="20" letter-spacing="4" fill="${colors.mutedText}">HAKKANEKO · COMMISSION</text>
      <text x="76" y="158" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" font-size="40" font-weight="700" fill="${colors.text}">委託需求摘要</text>
      <text x="76" y="198" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" font-size="20" fill="${colors.secondaryText}">委託編號：${escapeXml(quote.requestId || "—")}</text>
      <text x="1004" y="92" text-anchor="end" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" font-size="18" fill="${colors.mutedText}">${escapeXml(quote.date)}</text>
      ${detailMarkup}
      <rect x="76" y="${totalTop}" width="928" height="92" rx="16" fill="${colors.panel}"/>
      <text x="104" y="${totalTop + 38}" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" font-size="18" fill="${colors.secondaryText}">${escapeXml(quote.totalLabel)}</text>
      <text x="104" y="${totalTop + 72}" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" font-size="28" font-weight="700" fill="${colors.accent}">${escapeXml(quote.totalText)}</text>
      ${noteMarkup}
      <text x="76" y="${height - 56}" font-family="Noto Sans TC, Microsoft JhengHei, sans-serif" font-size="16" fill="${colors.mutedText}">請將此 PNG 附於 Google 表單，方便後續確認需求。</text>
    </svg>`;
  };

  const reportDownloadError = (error) => {
    console.error("無法產生需求摘要 PNG。", error);
    quoteStatus.dataset.state = "error";
    quoteStatus.textContent = "需求摘要無法下載，請重新整理頁面後再試。";
  };

  const downloadQuoteCard = () => {
    if (!currentQuote) return;
    const quote = currentQuote;
    quoteStatus.dataset.state = "loading";
    quoteStatus.textContent = "正在準備需求摘要 PNG…";
    try {
      const svgBlob = new Blob([createQuoteSvg(quote)], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();
      image.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        reportDownloadError(new Error("需求摘要 SVG 無法轉換成圖片"));
      };
      image.onload = () => {
        URL.revokeObjectURL(svgUrl);
        try {
          const canvas = document.createElement("canvas");
          const scale = 2;
          canvas.width = image.naturalWidth * scale;
          canvas.height = image.naturalHeight * scale;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("瀏覽器無法建立圖片畫布");
          context.scale(scale, scale);
          context.drawImage(image, 0, 0);
          canvas.toBlob((blob) => {
            if (!blob) {
              reportDownloadError(new Error("瀏覽器無法輸出 PNG 檔案"));
              return;
            }
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = `hakkaneko-commission-${quote.requestId || "quote"}.png`;
            link.click();
            URL.revokeObjectURL(downloadUrl);
            quoteStatus.dataset.state = "success";
            quoteStatus.textContent = `委託摘要 PNG（${quote.requestId || "無編號"}）已下載，可以附在 Google 表單中。`;
          }, "image/png");
        } catch (error) {
          reportDownloadError(error);
        }
      };
      image.src = svgUrl;
    } catch (error) {
      reportDownloadError(error);
    }
  };

  calculator.querySelectorAll("[data-quantity-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".quantity-stepper").querySelector('input[type="number"]');
      if (button.dataset.quantityStep === "up") input.stepUp();
      else input.stepDown();
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  calculator.addEventListener("input", renderSummary);
  calculator.addEventListener("change", (event) => {
    renderSummary();
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) ||
      !["service", "model-type", "model-plan"].includes(target.name)
    ) return;
    const includedAddons =
      selectedValue("service") === "model"
        ? getTopPlanFreeAddons(selectedValue("model-type"), selectedValue("model-plan"))
        : [];
    if (includedAddons.length > 0) showAutoAdditionsToast(includedAddons);
    else hideAutoAdditionsToast();
  });
  downloadButton.addEventListener("click", downloadQuoteCard);
  renderSummary();
}
