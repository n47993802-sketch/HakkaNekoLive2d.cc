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
const petVisibilityPreferenceKey = "hakka-pet-visible";
const petVisibilityToggles = [...document.querySelectorAll("[data-pet-visibility-toggle]")];
const preferencesToggle = document.querySelector("[data-preferences-toggle]");
const preferencesPanel = document.querySelector("[data-preferences-panel]");
const preferencesControls = document.querySelector("[data-preferences-controls]");
const mobilePreferencesTarget = document.querySelector("[data-mobile-preferences-target]");
const sitePreferences = document.querySelector(".site-preferences");
const preferencesViewportQuery = window.matchMedia("(max-width: 900px)");
const hakkaRuntimeSystemThemeQuery = window.matchMedia?.(
  "(prefers-color-scheme: dark)",
);
let registerRevealTargets = () => {};
let finishRevealTarget = (target) => target.classList.remove("is-revealing");
let petVisibilityEnabled = true;

try {
  petVisibilityEnabled = window.localStorage.getItem(petVisibilityPreferenceKey) !== "false";
} catch (error) {
  console.warn("無法讀取貓球顯示偏好。", error);
}
const setTheme = (theme, persist = false) => {
  const isNight = theme === "night";
  document.documentElement.dataset.theme = isNight ? "night" : "day";
  themeToggleButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(isNight));
    button.title = `目前為${isNight ? "夜間" : "日間"}模式，按一下切換至${isNight ? "日間" : "夜間"}模式`;
    button.querySelector("[data-theme-icon]").textContent = isNight ? "dark_mode" : "light_mode";
    button.querySelector("[data-theme-label]").textContent = isNight ? "夜間模式" : "日間模式";
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

const setPetVisibility = (visible, persist = false) => {
  petVisibilityEnabled = visible;
  petVisibilityToggles.forEach((toggle) => {
    toggle.setAttribute("aria-pressed", String(visible));
    toggle.title = visible ? "關閉首頁貓球" : "開啟首頁貓球";
    toggle.querySelector("[data-pet-visibility-icon]").textContent = visible
      ? "visibility"
      : "visibility_off";
    toggle.querySelector("[data-pet-visibility-label]").textContent = visible
      ? "貓球顯示中"
      : "貓球已關閉";
  });
  if (persist) {
    try {
      window.localStorage.setItem(petVisibilityPreferenceKey, String(visible));
    } catch (error) {
      console.warn("無法儲存貓球顯示偏好。", error);
    }
  }
  window.dispatchEvent(new CustomEvent("hakka-pet-visibility-change", {
    detail: { visible },
  }));
};

setPetVisibility(petVisibilityEnabled);
petVisibilityToggles.forEach((toggle) => {
  toggle.addEventListener("click", () => {
    setPetVisibility(toggle.getAttribute("aria-pressed") !== "true", true);
  });
});

const updatePreferencesLayout = (event = preferencesViewportQuery) => {
  if (!preferencesControls || !mobilePreferencesTarget || !sitePreferences) return;
  const useMobileMenu = event.matches;
  const destination = useMobileMenu ? mobilePreferencesTarget : preferencesPanel;
  if (destination && preferencesControls.parentElement !== destination) {
    destination.append(preferencesControls);
  }
  sitePreferences.classList.toggle("is-menu-mode", useMobileMenu);
};

updatePreferencesLayout();
if (typeof preferencesViewportQuery.addEventListener === "function") {
  preferencesViewportQuery.addEventListener("change", updatePreferencesLayout);
} else {
  preferencesViewportQuery.addListener(updatePreferencesLayout);
}

if (preferencesToggle && preferencesPanel) {
  const setPreferencesOpen = (open) => {
    preferencesToggle.setAttribute("aria-expanded", String(open));
    preferencesToggle.setAttribute("aria-label", open ? "關閉顯示設定" : "開啟顯示設定");
    preferencesPanel.hidden = !open;
  };

  preferencesToggle.addEventListener("click", () => {
    setPreferencesOpen(preferencesToggle.getAttribute("aria-expanded") !== "true");
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".site-preferences")) setPreferencesOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !preferencesPanel.hidden) {
      setPreferencesOpen(false);
      preferencesToggle.focus();
    }
  });
}

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
  const heroCardDialogue = heroCard.querySelector("[data-hero-dialogue]");
  const heroCardMessages = [
    "你在找我嗎？",
    "駭客面板啟動！",
    "需要更多的委託……",
    "更多有趣的 Live2D 正在前方等著我。",
    "如果發現什麼有趣的，要記得跟我說喔！",
    "今天也有好好休息嗎？",
    "嗯？這張圖有什麼特別的嗎？",
    "剛剛那個像素是不是在偷看我？",
    "別只看圖啦，跟我說說話嘛。",
    "我剛剛有擺好姿勢吧？",
    "這個角度還不錯，我喜歡。",
    "建模的細節，可是有認真打磨的喔。",
    "等等，我的特效跑去哪了？",
    "今天也想做出很棒的作品。",
    "你有看到旁邊的小方塊嗎？",
    "我才沒有在等你點我。",
    "要不要一起看看其他作品？",
    "Live2D 動起來的瞬間，最讓人期待了。",
    "是不是該起來活動一下了？",
    "欸，我剛剛是不是聽到快門聲？",
    "多看一會也沒關係，我不介意。",
    "這裡的像素小夥伴，今天也很忙呢。",
    "你來啦！……我只是剛好在這裡。",
    "偷偷告訴你，這裡藏了不少小細節。",
    "好啦，這次換我看你。",
  ];
  const AudioContextConstructor = window.AudioContext;
  let cardAudioContext;
  let lastDialogueIndex = -1;
  let dialogueTimer;

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
    heroCard.classList.remove("is-bouncing");
    void heroCard.offsetWidth;
    heroCard.classList.add("is-bouncing");

    let dialogueIndex = Math.floor(Math.random() * heroCardMessages.length);
    if (dialogueIndex === lastDialogueIndex) {
      dialogueIndex = (dialogueIndex + 1) % heroCardMessages.length;
    }
    lastDialogueIndex = dialogueIndex;
    heroCardDialogue.textContent = heroCardMessages[dialogueIndex];
    heroCardDialogue.classList.add("is-visible");
    clearTimeout(dialogueTimer);
    dialogueTimer = setTimeout(() => {
      heroCardDialogue.classList.remove("is-visible");
    }, 2200);

    playCardChime();
  });
}

const desktopPet = document.querySelector("[data-desktop-pet]");
if (desktopPet) {
  const character = desktopPet.querySelector("[data-pet-character]");
  const speech = desktopPet.querySelector("[data-pet-speech]");
  const speechText = speech.querySelector("[data-pet-speech-text]");
  const speechAccessibleText = speech.querySelector("[data-pet-speech-accessible]");
  const desktopViewportQuery = window.matchMedia("(min-width: 701px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let characterSize = desktopViewportQuery.matches ? 96 : 64;
  const gravity = 760;
  const airResistance = 1.7;
  const wallRestitution = 0.14;
  const maxFloorBounces = 3;
  const bounceRetention = [0.55, 0.42, 0.3];
  const minimumBounceSpeeds = [150, 110, 80];
  const horizontalImpactRetention = [0.78, 0.64, 0.48];
  const restingOffset = 12;
  const floatHorizontalRange = 48;
  const throwSpeedThreshold = 220;
  const throwDistanceThreshold = 18;
  const releaseVelocityTimeout = 140;
  const velocityWindow = 100;
  const floatAmplitude = 10;
  const idleBreathHeight = 8;
  const idleBreathDuration = 3200;
  const clickMessages = [
    [
      "嗯？幹嘛？",
      "你剛剛是不是戳我？",
      "喵？……不是我發出的聲音。",
      "我知道你在看我。",
      "你是不是有話要說？",
      "游標在你手上，不是我喔。",
      "我剛剛有在休息欸。",
    ],
    [
      "你剛剛是不是戳我？",
      "喵？……不是我發出的聲音。",
      "再戳一下，我就……我就不管你！",
      "這裡是臉，不是按鈕啦！",
      "可以先讓我把話說完嗎？",
    ],
    [
      "再戳一下，我就……我就不管你！",
      "……",
      "我知道你在看我。",
      "我有記下來喔。",
      "好啦，這次先原諒你。",
      "你是不是很閒？",
    ],
  ];
  const grabMessages = [
    "欸？",
    "等等等等！",
    "你抓錯東西了！",
    "我不是你的滑鼠墊！",
    "放開我！我還有事情要忙！",
    "我自己會飛啦！",
    "你要帶我去哪裡？",
    "放、放開我……",
  ];
  const slowDragMessages = [
    "……這是在帶我散步嗎？",
    "嗯？是要帶我去哪裡？",
    "慢一點，我還沒看完。",
    "這條路我好像沒走過。",
  ];
  const fastDragMessages = ["哇！太快了啦！", "慢一點！我快跟不上了！", "你是要把我甩出去嗎？"];
  const holdMessages = [
    "……我們要在這裡待多久？",
    "你抓著我也不會長出零食喔。",
    "現在是休息時間嗎？",
    "我可以先回去巡邏了嗎？",
  ];
  const releaseMessages = ["呼！自由了！", "我先走一步！", "終於可以自己動了。"];
  const hardThrowMessages = [
    "等一下——！",
    "你給我記住——！",
    "喵啊啊啊啊！",
    "我看見三個你了……",
    "哪邊是上面啊？",
  ];
  const gentleThrowMessages = ["咦？", "等一下——！", "你是在幫我熱身嗎？"];
  const repeatThrowMessages = [
    "這次我有防備了！",
    "你給我記住——！",
    "我看見三個你了……",
    "你又來？我還沒站穩欸！",
    "再丟我就躲起來！",
  ];
  const angryFallMessages = [
    "你把我當成球嗎？",
    "痛痛痛！這可不好笑！",
    "我真的要生氣了喔！",
  ];
  const silentFallMessages = [
    "……",
    "……（無言）",
    "我看見三個你了……",
    "我現在拒絕溝通。",
    "先不要跟我說話。",
  ];
  const gentleFallMessages = [
    "你是在幫我熱身嗎？",
    "……",
    "好像沒事。",
    "這樣算按摩嗎？",
    "我只是測試一下地心引力。",
  ];
  const hardFallMessages = [
    "我看見三個你了……",
    "喵啊啊啊啊！",
    "不要再轉了！",
    "我需要一點時間重新對焦。",
  ];
  const wallMessages = [
    "誰把牆放在這裡的！",
    "痛痛痛……這個牆有點硬欸！",
    "我剛剛是不是撞到畫面了？",
  ];
  const sleepyMessages = [
    "休眠中，請勿打擾……",
    "我不是睡著，只是在省電。",
    "晚點再叫我……呼嚕……",
  ];
  const petAppearingMessages = ["我回來了！", "想我了嗎？", "好啦，我出來了。"];
  const petHidingMessages = ["我先躲一下……", "好吧，休息一下。", "需要我時再叫我。"];
  const cursorMessages = ["我知道你在看我。", "你為什麼一直跟著我？", "我只是剛好飄過來。"];
  const patrolMessages = ["咳。剛剛只是巡邏。", "我本來就打算回來。", "沒有迷路，只是在繞路。"];
  const idleMessages = [
    "……",
    "嗯……",
    "剛剛要做什麼來著？",
    "這裡有沒有別的地方可以去？",
    "……算了，先待著。",
    "今天好像特別安靜。",
    "我是不是忘了什麼重要的事？",
    "再飄一下好了……就一下。",
  ];
  const emote = character.querySelector("[data-pet-emote]");
  const pickMessage = (messages) => messages[Math.floor(Math.random() * messages.length)];
  let x = Math.max(0, (window.innerWidth - characterSize) * 0.72);
  let y = getRestingY() - floatAmplitude;
  let movingRight = true;
  let velocityX = 0;
  let velocityY = 0;
  let floorBounces = 0;
  let mode = "floating";
  let dragged = false;
  let suppressClick = false;
  let pointerId = null;
  let projectilePointerPending = false;
  let pointerStart;
  let dragOriginPosition = null;
  let lastPointerSample;
  let pointerVelocitySamples = [];
  let pendingPointerPosition = null;
  let animationFrame = 0;
  let previousFrameTime = 0;
  let idleBreathStartedAt = performance.now();
  let idleBreathOffset = 0;
  let idleBreathScaleX = 1;
  let idleBreathScaleY = 1;
  let holdTimer = 0;
  let anticipationTimer = 0;
  let actionTimer = 0;
  let actionFrame = 0;
  let floatStartedAt = performance.now();
  let floatDuration = 5200;
  let floatPassesRemaining = 0;
  let floatSequenceIsGlide = false;
  let floatGlideDirection = 1;
  let floatPathStartX = x;
  let floatPathEndX = x;
  let floatPathStartY = y;
  let floatPathEndY = y;
  let floatPathStartVelocityX = 0;
  let floatPathEndVelocityX = 0;
  let restTimer = 0;
  let speechTimer = 0;
  let speechChangeTimer = 0;
  let speechTypingTimer = 0;
  let speechExitTimer = 0;
  let moodTimer = 0;
  let emoteExitTimer = 0;
  let visibilityAnimationTimer = 0;
  let visibilityHideTimer = 0;
  let idleThoughtTimer = 0;
  let clickResetTimer = 0;
  let clickCount = 0;
  let fallCount = 0;
  let lastFallAt = 0;
  let throwHadFloorContact = false;
  let angerTriggeredDuringFall = false;
  let pendingFallMessage = "";
  let recentThrowCount = 0;
  let lastThrowAt = 0;
  let lastThrownAt = 0;
  let currentThrowCountsAsFall = false;
  let currentThrowWasHigh = false;
  let currentThrowWasHard = false;
  let throwReturnPosition = null;
  let returningAfterThrow = false;
  let lastPointerPosition = null;
  let lastPointerMoveAt = 0;
  let lastInteractionAt = performance.now();
  let dragDialogueShown = false;
  let dragStillDialogueShown = false;
  let fastDragDialogueShown = false;
  let dragSpeed = 0;

  const getBounds = () => ({
    maxX: Math.max(0, window.innerWidth - characterSize),
    maxY: getRestingY(),
  });

  const isProjectileMode = () => mode === "preparing" || mode === "thrown";

  function getRestingY() {
    return Math.max(0, window.innerHeight - characterSize - restingOffset);
  }

  const renderCharacter = () => {
    const { maxX, maxY } = getBounds();
    x = Math.min(Math.max(x, 0), maxX);
    y = Math.min(Math.max(y, 0), maxY);
    const renderedY = Math.min(maxY, Math.max(0, y + idleBreathOffset));
    character.style.setProperty("--pet-x", `${x}px`);
    character.style.setProperty("--pet-y", `${renderedY}px`);
    character.style.setProperty("--pet-breath-scale-x", String(idleBreathScaleX));
    character.style.setProperty("--pet-breath-scale-y", String(idleBreathScaleY));
    character.style.setProperty("--pet-facing", movingRight ? "-1" : "1");
    character.classList.toggle("is-facing-right", movingRight);
    if (speech.classList.contains("is-visible")) {
      const halfWidth = speech.offsetWidth / 2;
      const centerX = Math.min(
        window.innerWidth - halfWidth - 12,
        Math.max(halfWidth + 12, x + characterSize / 2),
      );
      speech.style.left = `${centerX}px`;
      speech.style.top = `${Math.max(8, renderedY - speech.offsetHeight - 8)}px`;
    }
  };

  const setMode = (nextMode) => {
    const wasBreathing = mode === "floating" || mode === "resting";
    const willBreathe = nextMode === "floating" || nextMode === "resting";
    if (wasBreathing && !willBreathe) {
      y = Math.min(getRestingY(), Math.max(0, y + idleBreathOffset));
      idleBreathOffset = 0;
      idleBreathScaleX = 1;
      idleBreathScaleY = 1;
    } else if (!wasBreathing && willBreathe) {
      idleBreathStartedAt = performance.now();
      idleBreathOffset = 0;
      idleBreathScaleX = 1;
      idleBreathScaleY = 1;
    }
    mode = nextMode;
    character.dataset.motionState = mode;
    character.classList.toggle("is-floating", mode === "floating");
    character.classList.toggle("is-resting", mode === "resting");
    character.classList.toggle("is-preparing", mode === "preparing");
    character.classList.toggle("is-thrown", mode === "thrown");
    character.classList.toggle("is-dragging", mode === "dragging");
    renderCharacter();
  };

  const playAction = (className, duration = 650) => {
    window.clearTimeout(actionTimer);
    window.cancelAnimationFrame(actionFrame);
    character.classList.remove(className);
    actionFrame = window.requestAnimationFrame(() => {
      actionFrame = 0;
      character.classList.add(className);
      actionTimer = window.setTimeout(() => character.classList.remove(className), duration);
    });
  };

  const PetAudioContext = window.AudioContext || window.webkitAudioContext;
  let petAudioContext;
  let petAudioWarningShown = false;
  const playPetSound = (kind) => {
    if (!PetAudioContext) {
      if (!petAudioWarningShown) {
        console.warn("目前瀏覽器不支援貓球音效。");
        petAudioWarningShown = true;
      }
      return;
    }
    if (!petAudioContext) {
      try {
        petAudioContext = new PetAudioContext();
      } catch (error) {
        console.warn("無法建立貓球音效。", error);
        return;
      }
    }

    const play = () => {
      const now = petAudioContext.currentTime;
      const sounds = {
        tap: { type: "sine", volume: 0.025, duration: 0.13, notes: [[720, 920, 0], [980, 1180, 0.075]] },
        drag: { type: "triangle", volume: 0.025, duration: 0.2, notes: [[380, 210, 0]] },
        dragFast: { type: "sawtooth", volume: 0.018, duration: 0.14, notes: [[520, 170, 0]] },
        angry: { type: "square", volume: 0.022, duration: 0.17, notes: [[170, 118, 0], [145, 105, 0.08]] },
        escape: { type: "triangle", volume: 0.028, duration: 0.3, notes: [[420, 1040, 0], [680, 520, 0.1]] },
        spin: { type: "sine", volume: 0.022, duration: 0.28, notes: [[880, 520, 0], [660, 390, 0.07], [520, 300, 0.14]] },
        appear: { type: "sine", volume: 0.028, duration: 0.24, notes: [[420, 780, 0], [650, 1040, 0.1]] },
        disappear: { type: "triangle", volume: 0.024, duration: 0.32, notes: [[680, 260, 0], [520, 190, 0.1]] },
        throw: { type: "triangle", volume: 0.026, duration: 0.22, notes: [[300, 760, 0], [440, 240, 0.1]] },
      }[kind];
      if (!sounds) return;
      sounds.notes.forEach(([start, end, offset]) => {
        const noteStart = now + offset;
        const oscillator = petAudioContext.createOscillator();
        const gain = petAudioContext.createGain();
        oscillator.type = sounds.type;
        oscillator.frequency.setValueAtTime(start, noteStart);
        oscillator.frequency.exponentialRampToValueAtTime(end, noteStart + sounds.duration);
        gain.gain.setValueAtTime(0.0001, noteStart);
        gain.gain.exponentialRampToValueAtTime(sounds.volume, noteStart + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + sounds.duration);
        oscillator.connect(gain);
        gain.connect(petAudioContext.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + sounds.duration + 0.01);
      });
    };

    if (petAudioContext.state === "suspended") {
      petAudioContext.resume().then(play).catch((error) => {
        console.warn("無法播放貓球音效。", error);
      });
    } else {
      play();
    }
  };

  const setMood = (mood, duration = 1400) => {
    window.clearTimeout(moodTimer);
    window.clearTimeout(emoteExitTimer);
    if (mood === "angry") playPetSound("angry");
    character.dataset.mood = mood;
    emote.textContent = {
      curious: "？",
      happy: "✦",
      grabbed: "！",
      angry: "💢",
      scared: "！",
      dizzy: "💫",
      thoughtful: "…",
      sleepy: "Zzz",
    }[mood] || "";
    character.classList.toggle("is-sleeping", mood === "sleepy");
    emote.classList.remove("is-animated");
    emote.classList.remove("is-leaving");
    void emote.offsetWidth;
    emote.classList.add("is-animated");
    moodTimer = window.setTimeout(() => {
      window.clearTimeout(emoteExitTimer);
      character.dataset.mood = "";
      character.classList.remove("is-sleeping");
      emote.classList.remove("is-animated");
      emote.classList.add("is-leaving");
      emoteExitTimer = window.setTimeout(() => {
        if (!character.dataset.mood) emote.textContent = "";
        emote.classList.remove("is-leaving");
      }, 220);
    }, duration);
  };

  const dismissEmote = () => {
    window.clearTimeout(moodTimer);
    character.dataset.mood = "";
    emote.classList.remove("is-animated");
    emote.classList.add("is-leaving");
    character.classList.remove("is-sleeping");
    window.clearTimeout(emoteExitTimer);
    emoteExitTimer = window.setTimeout(() => {
      if (!character.dataset.mood) emote.textContent = "";
      emote.classList.remove("is-leaving");
    }, 220);
  };

  const scheduleThought = () => {
    window.clearTimeout(idleThoughtTimer);
    idleThoughtTimer = window.setTimeout(() => {
      if (document.visibilityState === "visible"
        && (mode === "floating" || mode === "resting")
        && petVisibilityEnabled
        && performance.now() - lastInteractionAt > 12000) {
        const idleDuration = performance.now() - lastInteractionAt;
        const cursorIsRecent = lastPointerPosition
          && performance.now() - lastPointerMoveAt < 9000;
        if (cursorIsRecent && Math.random() < 0.06) {
          chaseCursorBriefly();
        } else if (idleDuration > 45000 && Math.random() < 0.55) {
          setMood("sleepy", 9500);
          showSpeech(pickMessage(sleepyMessages));
          if (mode === "floating") scheduleRest(10000);
        } else {
          const mood = Math.random() < 0.65 ? "curious" : "thoughtful";
          setMood(mood, 4000);
          showSpeech(pickMessage(idleMessages));
        }
      }
      scheduleThought();
    }, 14000 + Math.random() * 9000);
  };

  const registerInteraction = () => {
    lastInteractionAt = performance.now();
    window.clearTimeout(idleThoughtTimer);
    dismissEmote();
    scheduleThought();
  };

  const scheduleRest = (duration = 3000 + Math.random() * 2000) => {
    const justLanded = isProjectileMode();
    const hadMultiFallReaction = angerTriggeredDuringFall || Boolean(pendingFallMessage);
    const shouldReturn = justLanded
      && !hadMultiFallReaction
      && currentThrowWasHigh
      && throwReturnPosition
      && Math.hypot(throwReturnPosition.x - x, throwReturnPosition.y - y) > 70
      && Math.random() < 0.45;
    window.clearTimeout(restTimer);
    velocityX = 0;
    velocityY = 0;
    setMode("resting");
    startAnimation();
    if (justLanded) {
      if (angerTriggeredDuringFall) {
        setMood("angry", 5000);
        showSpeech(pickMessage(angryFallMessages));
        angerTriggeredDuringFall = false;
        pendingFallMessage = "";
      } else if (pendingFallMessage) {
        setMood(pendingFallMessage === "……" || pendingFallMessage === "……（無言）"
          ? "thoughtful"
          : "dizzy", 4200);
        showSpeech(pendingFallMessage);
        pendingFallMessage = "";
      } else {
        setMood("happy", 3200);
        if (!shouldReturn && currentThrowWasHigh && Math.random() < 0.72) {
          showSpeech(currentThrowWasHard
            ? pickMessage([...hardFallMessages, ...patrolMessages])
            : pickMessage(gentleFallMessages));
        } else if (!shouldReturn && Math.random() < 0.52) {
          showSpeech("……");
        }
      }
    }
    if (shouldReturn) {
      const target = throwReturnPosition;
      throwReturnPosition = null;
      returningAfterThrow = true;
      floatSequenceIsGlide = false;
      floatPassesRemaining = 1;
      floatPathStartX = x;
      floatPathStartY = y;
      floatPathStartVelocityX = 0;
      floatPathEndX = target.x;
      floatPathEndY = target.y;
      floatPathEndVelocityX = 0;
      floatDuration = Math.min(10500, Math.max(
        2200,
        Math.hypot(target.x - x, target.y - y) / 52 * 1000,
      ));
      floatStartedAt = performance.now();
      setMode("floating");
      startAnimation();
      return;
    }
    if (justLanded) throwReturnPosition = null;
    restTimer = window.setTimeout(beginFloat, duration);
  };

  const chaseCursorBriefly = () => {
    if (!lastPointerPosition || (mode !== "resting" && mode !== "floating")
      || !desktopViewportQuery.matches || reducedMotionQuery.matches) return;
    const { maxX, maxY } = getBounds();
    const pointerDistanceX = lastPointerPosition.x - (x + characterSize / 2);
    const pointerDistanceY = lastPointerPosition.y - (y + characterSize / 2);
    const targetX = Math.min(
      maxX,
      Math.max(0, x + Math.max(-58, Math.min(58, pointerDistanceX))),
    );
    const targetY = Math.min(
      Math.max(0, maxY - 10),
      Math.max(0, y + Math.max(-38, Math.min(38, pointerDistanceY * 0.45))),
    );
    if (Math.hypot(targetX - x, targetY - y) < 10) return;
    window.clearTimeout(restTimer);
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    floatSequenceIsGlide = false;
    floatPassesRemaining = 1;
    floatPathStartX = x;
    floatPathStartY = y;
    floatPathStartVelocityX = mode === "floating"
      ? Math.max(-24, Math.min(
        24,
        (floatPathEndX - floatPathStartX) / (floatDuration / 1000),
      ))
      : 0;
    floatPathEndX = targetX;
    floatPathEndY = targetY;
    floatPathEndVelocityX = 0;
    floatDuration = 2300 + Math.random() * 700;
    floatStartedAt = performance.now();
    setMood("curious", 2800);
    showSpeech(pickMessage(cursorMessages));
    setMode("floating");
    startAnimation();
  };

  const planFloatLeg = () => {
    const { maxX, maxY } = getBounds();
    const dashMove = Math.random() < 0.08;
    const longMove = dashMove || Math.random() < 0.45;
    const distance = longMove
      ? 110 + Math.random() * 190
      : 24 + Math.random() * 52;
    const requestedDirection = floatSequenceIsGlide
      ? floatGlideDirection
      : Math.random() < 0.5 ? -1 : 1;
    let direction = requestedDirection;
    const availableDistance = direction > 0 ? maxX - floatPathStartX : floatPathStartX;
    const oppositeDistance = direction > 0 ? floatPathStartX : maxX - floatPathStartX;
    if (availableDistance < distance * 0.55 && oppositeDistance > availableDistance) {
      direction *= -1;
      if (floatSequenceIsGlide) floatGlideDirection = direction;
    }
    let targetX = Math.min(maxX, Math.max(0, floatPathStartX + direction * distance));
    if (Math.abs(targetX - floatPathStartX) < 12) {
      direction *= -1;
      targetX = Math.min(maxX, Math.max(0, floatPathStartX + direction * distance));
      if (floatSequenceIsGlide) floatGlideDirection = direction;
    }
    const actualDistance = Math.abs(targetX - floatPathStartX);
    const durationSeconds = dashMove
      ? 2.8 + Math.min(actualDistance / 150, 1.8) + Math.random() * 0.45
      : longMove
        ? 6 + Math.min(actualDistance / 65, 4) + Math.random() * 1.2
      : 3.8 + Math.random() * 2.2;
    floatPathEndX = targetX;
    const verticalDistance = 16 + Math.random() * 16;
    const minFloatY = Math.min(desktopViewportQuery.matches ? 12 : 82, maxY);
    const maxFloatY = Math.max(minFloatY, maxY - 14);
    let verticalDirection = Math.random() < 0.5 ? -1 : 1;
    let targetY = Math.min(
      maxFloatY,
      Math.max(minFloatY, floatPathStartY + verticalDirection * verticalDistance),
    );
    if (Math.abs(targetY - floatPathStartY) < 12) {
      verticalDirection *= -1;
      targetY = Math.min(
        maxFloatY,
        Math.max(minFloatY, floatPathStartY + verticalDirection * verticalDistance),
      );
    }
    floatPathEndY = targetY;
    floatDuration = durationSeconds * 1000;
    floatPathEndVelocityX = floatPassesRemaining === 1
      ? 0
      : direction * Math.min(8 + Math.random() * 7, Math.abs(targetX - floatPathStartX) * 0.45 / durationSeconds);
    floatStartedAt = performance.now();
  };

  function beginFloat() {
    if (!petVisibilityEnabled || reducedMotionQuery.matches) {
      setMode("resting");
      return;
    }
    window.clearTimeout(restTimer);
    floatSequenceIsGlide = Math.random() < 0.25;
    floatPassesRemaining = floatSequenceIsGlide
      ? 2 + Math.floor(Math.random() * 2)
      : 5 + Math.floor(Math.random() * 4);
    floatGlideDirection = Math.random() < 0.5 ? -1 : 1;
    floatPathStartX = x;
    floatPathStartY = y;
    floatPathStartVelocityX = 0;
    planFloatLeg();
    setMode("floating");
    startAnimation();
  }

  const moveAwayBriefly = (pointerX) => {
    const { maxX, maxY } = getBounds();
    playPetSound("escape");
    let direction = pointerX < x + characterSize / 2 ? 1 : -1;
    const distance = 130 + Math.random() * 90;
    const roomAhead = direction > 0 ? maxX - x : x;
    const roomBehind = direction > 0 ? x : maxX - x;
    if (roomAhead < distance * 0.5 && roomBehind > roomAhead) direction *= -1;
    floatSequenceIsGlide = false;
    floatPassesRemaining = 1;
    floatPathStartX = x;
    floatPathStartY = y;
    floatPathStartVelocityX = 0;
    floatPathEndX = Math.min(maxX, Math.max(0, x + direction * distance));
    if (Math.abs(floatPathEndX - x) < distance * 0.45) {
      floatPathEndX = Math.min(maxX, Math.max(0, x - direction * distance));
    }
    floatPathEndY = Math.min(maxY, Math.max(0, y - 24 - Math.random() * 32));
    floatPathEndVelocityX = 0;
    floatDuration = 950 + Math.random() * 450;
    floatStartedAt = performance.now();
    setMode("floating");
    startAnimation();
  };

  const animate = (time) => {
    animationFrame = 0;
    if ((mode === "floating" || mode === "resting") && !reducedMotionQuery.matches) {
      const phase = ((time - idleBreathStartedAt) % idleBreathDuration) / idleBreathDuration;
      const inhale = (1 - Math.cos(phase * Math.PI * 2)) / 2;
      idleBreathOffset = -idleBreathHeight * inhale;
      idleBreathScaleX = 1 + 0.02 * inhale;
      idleBreathScaleY = 1 - 0.01 * inhale;
    } else {
      idleBreathOffset = 0;
      idleBreathScaleX = 1;
      idleBreathScaleY = 1;
    }
    const delta = previousFrameTime
      ? Math.min((time - previousFrameTime) / 1000, 0.05)
      : 0;
    previousFrameTime = time;

    if (isProjectileMode()) {
      const friction = Math.exp(-airResistance * delta);
      velocityX *= friction;
      velocityY = (velocityY + gravity * delta) * friction;
      x += velocityX * delta;
      y += velocityY * delta;

      const { maxX, maxY } = getBounds();
      if ((x < 0 && velocityX < 0) || (x > maxX && velocityX > 0)) {
        x = Math.min(Math.max(x, 0), maxX);
        velocityX *= -wallRestitution;
        velocityY *= 0.76;
        if (Math.abs(velocityX) > 180) {
          setMood("scared", 1200);
          showSpeech(pickMessage(wallMessages));
          playAction("is-impacting", 620);
        }
        if (Math.abs(velocityX) > 1) movingRight = velocityX > 0;
      }
      if ((y < 0 && velocityY < 0) || (y > maxY && velocityY > 0)) {
        y = Math.min(Math.max(y, 0), maxY);
        if (velocityY > 0) {
          if (!throwHadFloorContact) {
            throwHadFloorContact = true;
            const impactTime = performance.now();
            if (currentThrowCountsAsFall) {
              if (impactTime - lastFallAt > 22000) fallCount = 0;
              lastFallAt = impactTime;
              fallCount += 1;
            }
          }
          if (fallCount >= 3) {
            fallCount = 0;
            const fallReactionRoll = Math.random();
            angerTriggeredDuringFall = fallReactionRoll < 0.62;
            pendingFallMessage = angerTriggeredDuringFall
              ? ""
              : silentFallMessages[Math.min(
                silentFallMessages.length - 1,
                Math.floor(((fallReactionRoll - 0.62) / 0.38) * silentFallMessages.length),
              )];
            if (angerTriggeredDuringFall) {
              setMood("angry", 5000);
            } else {
              setMood(pendingFallMessage === "……" || pendingFallMessage === "……（無言）"
                ? "thoughtful"
                : "dizzy", 4200);
            }
          }
          if (floorBounces < maxFloorBounces) {
            const bounceIndex = floorBounces;
            floorBounces += 1;
            character.dataset.impactBounce = String(floorBounces);
            if (bounceIndex === 0 && !angerTriggeredDuringFall && !pendingFallMessage) {
              setMood(currentThrowWasHard ? "dizzy" : "curious", 1800);
              if (currentThrowWasHigh) {
                showSpeech(pickMessage(currentThrowWasHard
                  ? hardFallMessages
                  : gentleFallMessages));
              }
            }
            playAction("is-impacting", 620);
            const bounceSpeed = Math.max(
              Math.abs(velocityY) * bounceRetention[bounceIndex],
              minimumBounceSpeeds[bounceIndex],
            );
            velocityY = -bounceSpeed * (0.92 + Math.random() * 0.16);
            velocityX *= horizontalImpactRetention[bounceIndex];
          } else {
            velocityY = 0;
            scheduleRest();
          }
        } else {
          velocityY *= -wallRestitution;
          velocityX *= 0.76;
        }
      }
      if (Math.hypot(velocityX, velocityY) < 34) {
        if (!isProjectileMode()) {
          velocityX = 0;
          velocityY = 0;
        } else if (y < maxY - 2) {
          velocityX *= 0.96;
          if (floorBounces === 0 || velocityY >= 0) {
            velocityY = Math.max(velocityY, 28);
          }
        } else if (floorBounces >= maxFloorBounces && velocityY >= 0) {
          scheduleRest();
        }
      }
    } else if (mode === "floating") {
      const progress = Math.min((time - floatStartedAt) / floatDuration, 1);
      const progressSquared = progress * progress;
      const progressCubed = progressSquared * progress;
      const durationSeconds = floatDuration / 1000;
      const startTangent = floatPathStartVelocityX * durationSeconds;
      const endTangent = floatPathEndVelocityX * durationSeconds;
      x = (2 * progressCubed - 3 * progressSquared + 1) * floatPathStartX
        + (progressCubed - 2 * progressSquared + progress) * startTangent
        + (-2 * progressCubed + 3 * progressSquared) * floatPathEndX
        + (progressCubed - progressSquared) * endTangent;
      const velocity = (
        (6 * progressSquared - 6 * progress) * floatPathStartX
        + (3 * progressSquared - 4 * progress + 1) * startTangent
        + (-6 * progressSquared + 6 * progress) * floatPathEndX
        + (3 * progressSquared - 2 * progress) * endTangent
      ) / durationSeconds;
      if (Math.abs(velocity) > 0.05) movingRight = velocity > 0;
      const easedProgress = progressSquared * (3 - 2 * progress);
      y = floatPathStartY + (floatPathEndY - floatPathStartY) * easedProgress;
      if (progress >= 1) {
        floatPassesRemaining -= 1;
        if (floatPassesRemaining > 0) {
          floatPathStartX = x;
          floatPathStartY = y;
          floatPathStartVelocityX = floatPathEndVelocityX;
          planFloatLeg();
        } else if (returningAfterThrow) {
          returningAfterThrow = false;
          setMood("happy", 3500);
          showSpeech(pickMessage(patrolMessages));
          scheduleRest();
        } else {
          scheduleRest(Math.random() < 0.12
            ? 900 + Math.random() * 700
            : undefined);
        }
      }
    }

    renderCharacter();
    if ((mode === "floating"
      || isProjectileMode()
      || (mode === "resting" && petVisibilityEnabled && !reducedMotionQuery.matches))
      && !animationFrame) {
      animationFrame = window.requestAnimationFrame(animate);
    } else {
      previousFrameTime = 0;
    }
  };

  const startAnimation = () => {
    if (!animationFrame
      && (mode === "floating"
        || isProjectileMode()
        || (mode === "resting" && petVisibilityEnabled && !reducedMotionQuery.matches))) {
      previousFrameTime = 0;
      animationFrame = window.requestAnimationFrame(animate);
    }
  };

  const renderPendingDrag = () => {
    animationFrame = 0;
    if (mode !== "dragging" || !pendingPointerPosition) return;
    x = pendingPointerPosition.x;
    y = pendingPointerPosition.y;
    pendingPointerPosition = null;
    renderCharacter();
  };

  const showSpeech = (message) => {
    window.clearTimeout(speechTimer);
    window.clearTimeout(speechChangeTimer);
    window.clearTimeout(speechTypingTimer);
    window.clearTimeout(speechExitTimer);
    const mood = character.dataset.mood || "";
    const displayMessage = () => {
      speechText.textContent = "";
      speechAccessibleText.textContent = message;
      speech.dataset.mood = mood;
      speech.dataset.tone = ["happy", "curious", "thoughtful", "sleepy"].includes(mood)
        ? "calm"
        : "animated";
      speech.classList.add("is-visible", "is-typing");
      renderCharacter();
      const graphemes = Array.from(message);
      const typingDelay = mood === "angry" ? 28
        : mood === "scared" ? 44
          : mood === "sleepy" || mood === "thoughtful" ? 145
            : mood === "curious" || mood === "happy" ? 120
              : 92;
      let index = 0;
      const typeNextGrapheme = () => {
        if (index >= graphemes.length) {
          speech.classList.remove("is-typing");
          speechText.classList.remove("is-typing-tick");
          speechTimer = window.setTimeout(() => {
            speech.classList.remove("is-visible", "is-typing");
            speechExitTimer = window.setTimeout(() => {
              if (!speech.classList.contains("is-visible")) {
                speechText.textContent = "";
                speechAccessibleText.textContent = "";
                speech.removeAttribute("data-mood");
                speech.removeAttribute("data-tone");
              }
            }, 180);
          }, 1800);
          return;
        }
        const glyph = document.createElement("span");
        glyph.textContent = graphemes[index];
        glyph.style.setProperty("--pet-glyph-delay", `${Math.min(index * 24, 480)}ms`);
        speechText.append(glyph);
        index += 1;
        speechText.classList.remove("is-typing-tick");
        void speechText.offsetWidth;
        speechText.classList.add("is-typing-tick");
        renderCharacter();
        speechTypingTimer = window.setTimeout(typeNextGrapheme, typingDelay);
      };
      typeNextGrapheme();
    };
    if (speech.classList.contains("is-visible") && speechText.textContent !== message) {
      speech.classList.remove("is-visible", "is-typing", "is-typing-tick");
      speechAccessibleText.textContent = "";
      speechChangeTimer = window.setTimeout(displayMessage, 160);
    } else {
      displayMessage();
    }
  };

  const dismissSpeech = () => {
    window.clearTimeout(speechTimer);
    window.clearTimeout(speechChangeTimer);
    window.clearTimeout(speechTypingTimer);
    window.clearTimeout(speechExitTimer);
    speech.classList.remove("is-visible", "is-typing");
    speechText.classList.remove("is-typing-tick");
    speechAccessibleText.textContent = "";
    speechExitTimer = window.setTimeout(() => {
      if (!speech.classList.contains("is-visible")) {
        speechText.textContent = "";
        speech.removeAttribute("data-mood");
        speech.removeAttribute("data-tone");
      }
    }, 180);
  };

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    lastPointerPosition = { x: event.clientX, y: event.clientY };
    lastPointerMoveAt = event.timeStamp;
  }, { passive: true });

  character.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (isProjectileMode()) {
      registerInteraction();
      pointerId = event.pointerId;
      dragOriginPosition = { x, y };
      pointerStart = { x: event.clientX, y: event.clientY };
      lastPointerSample = { x: event.clientX, y: event.clientY, time: event.timeStamp };
      pointerVelocitySamples = [lastPointerSample];
      projectilePointerPending = true;
      dragged = false;
      character.classList.remove("is-dragging-fast", "is-dragging-slow");
      character.style.setProperty("--pet-drag-tilt", "0deg");
      character.style.setProperty("--pet-drag-stretch", "1");
      character.setPointerCapture(pointerId);
      return;
    }
    if ((mode === "floating" || mode === "resting")
      && lastThrownAt > 0
      && performance.now() - lastThrownAt < 7000
      && Math.random() < 0.16) {
      event.preventDefault();
      suppressClick = true;
      window.setTimeout(() => { suppressClick = false; }, 300);
      registerInteraction();
      setMood("scared", 1300);
      showSpeech("這次我有防備了！");
      playAction("is-performing", 620);
      moveAwayBriefly(event.clientX);
      return;
    }
    registerInteraction();
    projectilePointerPending = false;
    returningAfterThrow = false;
    throwReturnPosition = null;
    window.clearTimeout(restTimer);
    window.clearTimeout(holdTimer);
    window.clearTimeout(anticipationTimer);
    window.clearTimeout(actionTimer);
    window.cancelAnimationFrame(actionFrame);
    actionFrame = 0;
    character.classList.remove(
      "is-impacting",
      "is-performing",
      "is-grabbed",
      "is-preparing",
      "is-anticipating",
    );
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    pendingPointerPosition = null;
    dragOriginPosition = { x, y };
    setMode("dragging");
    dragged = false;
    dragDialogueShown = false;
    dragStillDialogueShown = false;
    fastDragDialogueShown = false;
    dragSpeed = 0;
    floorBounces = 0;
    pointerId = event.pointerId;
    pointerStart = { x: event.clientX, y: event.clientY };
    lastPointerSample = { x: event.clientX, y: event.clientY, time: event.timeStamp };
    pointerVelocitySamples = [lastPointerSample];
    velocityX = 0;
    velocityY = 0;
    character.classList.remove("is-dragging-fast", "is-dragging-slow");
    character.style.setProperty("--pet-drag-tilt", "0deg");
    character.style.setProperty("--pet-drag-stretch", "1");
    holdTimer = window.setTimeout(() => {
      if (mode === "dragging" && !dragged) {
        suppressClick = true;
        window.setTimeout(() => { suppressClick = false; }, 300);
        setMood("grabbed", 1200);
        showSpeech("欸？");
        playAction("is-grabbed", 560);
        holdTimer = window.setTimeout(() => {
          if (mode === "dragging" && !dragged) {
            setMood("thoughtful", 2600);
            showSpeech(pickMessage(holdMessages));
          }
        }, 1200);
      }
    }, 500);
    character.setPointerCapture(pointerId);
  });

  character.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    if (projectilePointerPending) {
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) <= 6) return;
      projectilePointerPending = false;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      window.clearTimeout(actionTimer);
      window.cancelAnimationFrame(actionFrame);
      actionFrame = 0;
      character.classList.remove("is-impacting", "is-performing", "is-preparing", "is-anticipating");
      dragDialogueShown = false;
      floorBounces = 0;
      setMode("dragging");
    }
    if (mode !== "dragging") return;
    const now = event.timeStamp;
    const deltaX = event.clientX - lastPointerSample.x;
    let dragJustStarted = false;
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6) {
      dragged = true;
      if (!dragDialogueShown) {
        dragDialogueShown = true;
        dragJustStarted = true;
      }
    }
    pendingPointerPosition = {
      x: event.clientX - characterSize / 2,
      y: event.clientY - characterSize / 2,
    };
    const currentSample = { x: event.clientX, y: event.clientY, time: now };
    if (now - lastPointerSample.time > releaseVelocityTimeout) {
      pointerVelocitySamples = [currentSample];
      velocityX = 0;
      velocityY = 0;
    } else {
      pointerVelocitySamples.push(currentSample);
      while (pointerVelocitySamples.length > 2
        && pointerVelocitySamples[1].time < now - velocityWindow) {
        pointerVelocitySamples.shift();
      }
      while (pointerVelocitySamples.length > 12) pointerVelocitySamples.shift();
      const velocityStart = pointerVelocitySamples[0];
      const sampleDuration = Math.max((now - velocityStart.time) / 1000, 0.06);
      velocityX = (event.clientX - velocityStart.x) / sampleDuration;
      velocityY = (event.clientY - velocityStart.y) / sampleDuration;
    }
    dragSpeed = Math.hypot(velocityX, velocityY);
    const dragIsFast = dragSpeed > 520;
    character.classList.toggle("is-dragging-fast", dragIsFast);
    character.classList.toggle("is-dragging-slow", !dragIsFast);
    character.style.setProperty(
      "--pet-drag-tilt",
      `${Math.max(-13, Math.min(13, -velocityX / 58))}deg`,
    );
    character.style.setProperty(
      "--pet-drag-stretch",
      `${1 + Math.min(0.14, dragSpeed / 6500)}`,
    );
    if (dragJustStarted) {
      playPetSound("drag");
      setMood("grabbed", 1500);
      showSpeech(dragIsFast
        ? pickMessage(fastDragMessages)
        : Math.random() < 0.35
          ? pickMessage(grabMessages)
          : pickMessage(slowDragMessages));
      fastDragDialogueShown = dragIsFast;
      playAction("is-grabbed", 560);
    } else if (dragIsFast && dragged && !fastDragDialogueShown) {
      fastDragDialogueShown = true;
      playPetSound("dragFast");
      setMood("scared", 1500);
      showSpeech(pickMessage(fastDragMessages));
    }
    if (dragged) {
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => {
        if (mode === "dragging" && dragged && !dragStillDialogueShown
          && performance.now() - lastPointerSample.time > 850) {
          dragStillDialogueShown = true;
          setMood("thoughtful", 2500);
          showSpeech(pickMessage(holdMessages));
        }
      }, 1000);
    }
    if (Math.abs(deltaX) > 1) movingRight = deltaX > 0;
    lastPointerSample = { x: event.clientX, y: event.clientY, time: now };
    if (!animationFrame) animationFrame = window.requestAnimationFrame(renderPendingDrag);
  });

  const finishDrag = (event) => {
    if (projectilePointerPending && event.pointerId === pointerId) {
      projectilePointerPending = false;
      pointerId = null;
      pointerVelocitySamples = [];
      return;
    }
    if (mode !== "dragging" || event.pointerId !== pointerId) return;
    window.clearTimeout(holdTimer);
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (pendingPointerPosition) {
      x = pendingPointerPosition.x;
      y = pendingPointerPosition.y;
      pendingPointerPosition = null;
    }
    pointerId = null;
    if (dragged) {
      const dragX = lastPointerSample.x - pointerStart.x;
      const releaseAge = Math.max(0, event.timeStamp - lastPointerSample.time);
      const releaseScale = Math.max(0, 1 - releaseAge / releaseVelocityTimeout);
      velocityX = Math.max(-900, Math.min(900, velocityX * releaseScale));
      velocityY = Math.max(-1100, Math.min(1100, velocityY * releaseScale));
      const recentMotion = pointerVelocitySamples.length
        ? Math.hypot(
          lastPointerSample.x - pointerVelocitySamples[0].x,
          lastPointerSample.y - pointerVelocitySamples[0].y,
        )
        : 0;
      if (Math.hypot(velocityX, velocityY) < throwSpeedThreshold
        || recentMotion < throwDistanceThreshold) {
        velocityX = 0;
        velocityY = 0;
      }
      dragSpeed = 0;
      floorBounces = 0;
      if (Math.abs(dragX) > 1) movingRight = dragX > 0;
      suppressClick = true;
      window.setTimeout(() => { suppressClick = false; }, 300);
      character.classList.remove("is-dragging-fast", "is-dragging-slow");
      const launchSpeed = Math.hypot(velocityX, velocityY);
      const releaseHeight = getRestingY() - y;
      const estimatedApexHeight = releaseHeight
        + (velocityY < 0 ? (velocityY * velocityY) / (2 * gravity) : 0);
      currentThrowCountsAsFall = launchSpeed >= throwSpeedThreshold || releaseHeight >= 80;
      currentThrowWasHigh = estimatedApexHeight >= 120;
      currentThrowWasHard = launchSpeed >= 650;
      const gentleRelease = launchSpeed < throwSpeedThreshold && releaseHeight < 80;
      if (!gentleRelease && (launchSpeed > 0 || y < getRestingY() - 2)) {
        const launchTime = performance.now();
        if (launchTime - lastThrowAt > 18000) recentThrowCount = 0;
        recentThrowCount += 1;
        lastThrowAt = launchTime;
        lastThrownAt = launchTime;
        throwHadFloorContact = false;
        throwReturnPosition = dragOriginPosition ? { ...dragOriginPosition } : { x, y };
      }
      if (velocityX !== 0 || velocityY !== 0) {
        setMode("thrown");
        setMood("scared", 1600);
        playPetSound("throw");
        if (currentThrowWasHigh) {
          playPetSound("spin");
          const launchMessage = recentThrowCount > 1
            ? pickMessage(repeatThrowMessages)
            : currentThrowWasHard
              ? pickMessage(hardThrowMessages)
              : pickMessage(gentleThrowMessages);
          showSpeech(launchMessage);
        } else {
          dismissSpeech();
        }
        character.classList.add("is-anticipating");
        anticipationTimer = window.setTimeout(() => {
          character.classList.remove("is-anticipating");
        }, 180);
        startAnimation();
      } else if (releaseHeight >= 80) {
        velocityX = 0;
        velocityY = 0;
        floorBounces = 0;
        setMode("thrown");
        setMood("scared", 1100);
        playPetSound(currentThrowWasHigh ? "spin" : "throw");
        if (currentThrowWasHigh) showSpeech("咦？");
        else dismissSpeech();
        startAnimation();
      } else {
        setMood("happy");
        showSpeech(pickMessage(releaseMessages));
        moveAwayBriefly(pointerStart.x);
      }
      playAction("is-release-rebound", 480);
    } else {
      velocityX = 0;
      velocityY = 0;
      scheduleRest();
    }
    pointerVelocitySamples = [];
    renderCharacter();
  };

  character.addEventListener("pointerup", finishDrag);
  character.addEventListener("pointercancel", finishDrag);
  character.addEventListener("click", (event) => {
    if (suppressClick) {
      event.preventDefault();
      suppressClick = false;
      return;
    }
    playPetSound("tap");
    registerInteraction();
    clickCount += 1;
    window.clearTimeout(clickResetTimer);
    clickResetTimer = window.setTimeout(() => { clickCount = 0; }, 5500);
    const messageSet = clickMessages[clickCount >= 4 ? 2 : clickCount >= 2 ? 1 : 0];
    const rareMessage = clickCount === 1 && Math.random() < 0.015;
    setMood(clickCount >= 4 ? "angry" : clickCount === 1 ? "curious" : "happy");
    if (Math.random() < (clickCount >= 4 ? 0.92 : 0.94)) {
      showSpeech(rareMessage
        ? "……沒有啦，我才沒有在等你。"
        : pickMessage(messageSet));
    }
    playAction("is-performing", 820);
  });

  window.addEventListener("resize", () => {
    const { maxX, maxY } = getBounds();
    x = Math.min(x, maxX);
    y = mode === "resting" || mode === "floating"
      ? Math.max(0, getRestingY() - floatAmplitude)
      : Math.min(y, maxY);
    if (mode === "floating") floatOriginY = y;
    renderCharacter();
  });
  const updateViewportMotion = () => {
    const nextCharacterSize = desktopViewportQuery.matches ? 96 : 64;
    if (nextCharacterSize !== characterSize) {
      x += (characterSize - nextCharacterSize) / 2;
      characterSize = nextCharacterSize;
      y = Math.min(y, getRestingY());
    }
    if (!petVisibilityEnabled) return;
    if (reducedMotionQuery.matches) {
      window.clearTimeout(restTimer);
      window.clearTimeout(anticipationTimer);
      window.clearTimeout(holdTimer);
      character.classList.remove("is-anticipating");
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      pendingPointerPosition = null;
      pointerId = null;
      idleBreathOffset = 0;
      idleBreathScaleX = 1;
      idleBreathScaleY = 1;
      returningAfterThrow = false;
      throwReturnPosition = null;
      dismissSpeech();
      dismissEmote();
      setMode("resting");
    } else if (mode === "resting") {
      beginFloat();
    }
  };
  const handlePetVisibilityChange = (event) => {
    window.clearTimeout(visibilityAnimationTimer);
    window.clearTimeout(visibilityHideTimer);
    character.classList.remove("is-appearing", "is-disappearing");
    if (event.detail.visible) {
      desktopPet.hidden = false;
      character.hidden = false;
      character.classList.add("is-appearing");
      playPetSound("appear");
      setMood("happy", 3000);
      showSpeech(pickMessage(petAppearingMessages));
      if (reducedMotionQuery.matches) setMode("resting");
      else beginFloat();
      visibilityAnimationTimer = window.setTimeout(() => {
        character.classList.remove("is-appearing");
      }, 720);
      return;
    }
    if (desktopPet.hidden) return;
    window.clearTimeout(restTimer);
    window.clearTimeout(holdTimer);
    window.clearTimeout(anticipationTimer);
    window.clearTimeout(actionTimer);
    window.cancelAnimationFrame(actionFrame);
    actionFrame = 0;
    character.classList.remove(
      "is-impacting",
      "is-performing",
      "is-grabbed",
      "is-preparing",
      "is-anticipating",
    );
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    pointerId = null;
    pendingPointerPosition = null;
    velocityX = 0;
    velocityY = 0;
    setMode("resting");
    character.classList.add("is-disappearing");
    playPetSound("disappear");
    setMood("thoughtful", 3600);
    showSpeech(pickMessage(petHidingMessages));
    visibilityAnimationTimer = window.setTimeout(() => {
      character.classList.remove("is-disappearing");
      character.hidden = true;
    }, 720);
    visibilityHideTimer = window.setTimeout(() => {
      desktopPet.hidden = true;
      dismissSpeech();
      dismissEmote();
    }, 3600);
  };
  if (typeof desktopViewportQuery.addEventListener === "function") {
    desktopViewportQuery.addEventListener("change", updateViewportMotion);
    reducedMotionQuery.addEventListener("change", updateViewportMotion);
  } else {
    desktopViewportQuery.addListener(updateViewportMotion);
    reducedMotionQuery.addListener(updateViewportMotion);
  }
  window.addEventListener("hakka-pet-visibility-change", handlePetVisibilityChange);

  renderCharacter();
  desktopPet.hidden = !petVisibilityEnabled;
  if (petVisibilityEnabled && !reducedMotionQuery.matches) {
    beginFloat();
  } else {
    setMode("resting");
  }
  scheduleThought();
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
