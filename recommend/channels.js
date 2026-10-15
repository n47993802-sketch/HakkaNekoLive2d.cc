const channelsConfig = globalThis.CHANNELS_CONFIG;
const channelList = document.querySelector("[data-channel-list]");
const channelStatusMessage = document.querySelector("[data-channel-status-message]");
const channelUpdated = document.querySelector("[data-channel-updated]");
const channelRefreshButton = document.querySelector("[data-channel-refresh]");

if (
  channelsConfig &&
  channelList &&
  channelStatusMessage &&
  channelUpdated &&
  channelRefreshButton
) {
  const channelStatuses = new Map();
  const channelOrder = new Map(
    channelsConfig.channels.map((channel, index) => [channel.key, index]),
  );

  const platformNames = {
    twitch: "Twitch",
    youtube: "YouTube",
  };
  const platformIconPaths = {
    twitch: [
      { d: "M4 3h17v12l-5 5h-4l-3 3v-3H7v-3H4V3Z" },
      { d: "M10 7v5M15 7v5" },
    ],
    youtube: [
      {
        d: "M23.5 6.2c-.3-1.1-1.2-2-2.3-2.3C19.2 3.4 12 3.4 12 3.4s-7.2 0-9.2.5C1.7 4.2.8 5.1.5 6.2 0 8.3 0 12 0 12s0 3.7.5 5.8c.3 1.1 1.2 2 2.3 2.3 2 .5 9.2.5 9.2.5s7.2 0 9.2-.5c1.1-.3 2-1.2 2.3-2.3.5-2.1.5-5.8.5-5.8s0-3.7-.5-5.8Z",
      },
      { d: "m9.6 15.6 6.2-3.6-6.2-3.6v7.2Z" },
    ],
  };
  const createPlatformIcon = (type) => {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.classList.add("channel-platform-icon");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    platformIconPaths[type].forEach((attributes) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      Object.entries(attributes).forEach(([name, value]) => path.setAttribute(name, value));
      icon.append(path);
    });
    return icon;
  };
  const stateLabels = {
    online: "直播中",
    offline: "目前離線",
    unknown: "暫時無法確認",
  };

  channelsConfig.channels.forEach((channel) => {
    channelStatuses.set(
      channel.key,
      Object.fromEntries(channel.platforms.map((platform) => [platform.type, "unknown"])),
    );
  });

  const getChannelState = (channel) => {
    const states = Object.values(channelStatuses.get(channel.key) || {});
    if (states.includes("online")) return "online";
    if (states.length > 0 && states.every((state) => state === "offline")) return "offline";
    return "unknown";
  };

  const sortChannelCards = () => {
    const cards = [...channelList.querySelectorAll(".channel-card")];
    cards.sort((first, second) => {
      const firstOnline =
        getChannelState(channelsConfig.channels.find((channel) => channel.key === first.dataset.channelKey)) ===
        "online";
      const secondOnline =
        getChannelState(channelsConfig.channels.find((channel) => channel.key === second.dataset.channelKey)) ===
        "online";
      return (
        Number(secondOnline) - Number(firstOnline) ||
        channelOrder.get(first.dataset.channelKey) - channelOrder.get(second.dataset.channelKey)
      );
    });
    channelList.append(...cards);
  };

  const renderCounts = () => {
    channelStatusMessage.textContent = `共 ${channelsConfig.channels.length} 個推薦頻道`;
  };

  const renderStatus = (channel, card) => {
    const state = getChannelState(channel);
    const badge = card.querySelector("[data-channel-state]");
    badge.textContent = "";
    badge.dataset.state = state;
    badge.setAttribute("aria-label", `整體頻道狀態：${stateLabels[state]}`);
    badge.title = `整體頻道狀態：${stateLabels[state]}`;

    card.querySelectorAll("[data-platform-type]").forEach((node) => {
      const platformState =
        channelStatuses.get(channel.key)?.[node.dataset.platformType] || "unknown";
      node.textContent = stateLabels[platformState];
      node.dataset.state = platformState;
      const platform = channel.platforms.find(
        (item) => item.type === node.dataset.platformType,
      );
      node.closest(".channel-platform-link").setAttribute(
        "aria-label",
        `${platformNames[platform.type]} 頻道 ${platform.label}：${stateLabels[platformState]}`,
      );
    });
  };

  const renderChannel = (channel) => {
    const card = document.createElement("article");
    card.className = "channel-card";
    card.dataset.channelKey = channel.key;

    const heading = document.createElement("div");
    heading.className = "channel-card-heading";

    const avatar = document.createElement("span");
    avatar.className = "channel-avatar";
    const image = document.createElement("img");
    image.src = channel.avatar.src;
    image.alt = channel.avatar.alt;
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      avatar.replaceChildren(document.createTextNode(channel.name.slice(0, 1)));
      avatar.classList.add("artist-avatar-fallback");
    }, { once: true });
    avatar.append(image);

    const identity = document.createElement("div");
    identity.className = "channel-card-identity";
    const name = document.createElement("h3");
    name.textContent = channel.name;
    identity.append(name);

    const status = document.createElement("span");
    status.className = "channel-state";
    status.dataset.channelState = "";
    status.setAttribute("role", "img");
    heading.append(avatar, identity, status);
    card.append(heading);

    const bio = document.createElement("p");
    bio.className = "channel-bio";
    bio.textContent = channel.bio;
    card.append(bio);

    const platforms = document.createElement("div");
    platforms.className = "channel-platforms";
    channel.platforms.forEach((platform) => {
      const link = document.createElement("a");
      link.className = `channel-platform-link channel-platform-${platform.type}`;
      link.href = platform.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const platformIcon = createPlatformIcon(platform.type);
      link.append(platformIcon);

      const platformStatus = document.createElement("small");
      platformStatus.className = "channel-platform-state";
      platformStatus.dataset.platformType = platform.type;
      platformStatus.dataset.platformLabel = platform.label;
      platformStatus.textContent = stateLabels.unknown;
      platformStatus.dataset.state = "unknown";
      link.append(platformStatus);
      platforms.append(link);
    });
    card.append(platforms);

    renderStatus(channel, card);
    return card;
  };

  channelList.replaceChildren(
    ...channelsConfig.channels.map((channel) => renderChannel(channel)),
  );
  registerRevealTargets(channelList.querySelectorAll(".channel-card"));

  const updateChannelStatuses = (statuses) => {
    channelsConfig.channels.forEach((channel) => {
      const next = statuses[channel.key] || {};
      channelStatuses.set(
        channel.key,
        Object.fromEntries(
          channel.platforms.map((platform) => {
            const state = next[platform.type];
            return [
              platform.type,
              state === "online" || state === "offline" ? state : "unknown",
            ];
          }),
        ),
      );
      const card = [...channelList.querySelectorAll(".channel-card")].find(
        (item) => item.dataset.channelKey === channel.key,
      );
      if (card) renderStatus(channel, card);
    });
    sortChannelCards();
    renderCounts();
  };

  const checkTwitchStatus = async (channel) => {
    const twitchPlatform = channel.platforms.find((platform) => platform.type === "twitch");
    if (!twitchPlatform) return "unknown";

    const login = twitchPlatform.label.trim();
    try {
      const response = await fetch(
        `https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(login)}`,
        { cache: "no-store", signal: window.createHakkaTimeoutSignal(8000) },
      );
      if (!response.ok) {
        throw new Error(`IVR 狀態服務回應錯誤：HTTP ${response.status}`);
      }
      const users = await response.json();
      const user = Array.isArray(users)
        ? users.find((entry) => entry.login?.toLowerCase() === login.toLowerCase())
        : null;
      if (user && Object.hasOwn(user, "stream")) {
        return user.stream ? "online" : "offline";
      }
      throw new Error(`IVR 狀態服務找不到 Twitch 頻道：${login}`);
    } catch (ivrError) {
      try {
        const response = await fetch(
          `https://decapi.me/twitch/uptime/${encodeURIComponent(login)}`,
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
        console.warn(`無法查詢 Twitch 頻道「${login}」的直播狀態。`, {
          ivrError,
          decapiError,
        });
        return "unknown";
      }
    }
  };

  const checkYoutubeStatus = async (platform) => {
    const handle = platform.label.trim().replace(/^@+/, "");
    const urls = [];
    if (handle) urls.push(`https://www.youtube.com/@${handle}/live`);
    if (platform.youtubeChannelId) {
      urls.push(`https://www.youtube.com/channel/${platform.youtubeChannelId}/live`);
    }

    const proxies = [];
    const youtubeProxyEndpoint = String(channelsConfig.youtubeProxyEndpoint || "").trim();
    if (youtubeProxyEndpoint) {
      proxies.push({
        name: "Cloudflare Worker",
        buildUrl: (url) => {
          const proxyUrl = new URL(youtubeProxyEndpoint);
          proxyUrl.searchParams.set("url", url);
          return proxyUrl.toString();
        },
      });
    }
    proxies.push(
      {
        name: "AllOrigins",
        buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      },
    );
    const corsproxyApiKey = channelsConfig.corsproxyApiKey.trim();
    if (corsproxyApiKey) {
      proxies.push({
        name: "Corsproxy.io",
        buildUrl: (url) => {
          const params = new URLSearchParams({ key: corsproxyApiKey, url });
          return `https://corsproxy.io/?${params}`;
        },
      });
    }

    const errors = [];
    for (const url of [...new Set(urls)]) {
      for (const proxy of proxies) {
        try {
          const response = await fetch(proxy.buildUrl(url), {
            cache: "no-store",
            signal: window.createHakkaTimeoutSignal(3000),
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const html = await response.text();
          const page = html.toLowerCase();
          const liveNow = page.match(
            /"livebroadcastdetails"\s*:\s*\{[^}]*"islivenow"\s*:\s*(true|false)/,
          );
          if (liveNow) {
            return liveNow[1] === "true" ? "online" : "offline";
          }
          if (!page.includes("ytinitialdata") && !page.includes("ytcfg.set")) {
            throw new Error("回傳無法辨識的 YouTube 頁面");
          }
          return "offline";
        } catch (error) {
          errors.push(`${proxy.name}: ${error.message}`);
        }
      }
    }

    console.warn(`無法查詢 YouTube 頻道「${platform.label}」的直播狀態。`, errors);
    return "unknown";
  };

  const loadPublicStatuses = async () => {
    channelStatusMessage.hidden = true;
    channelStatusMessage.textContent = "";
    const statuses = {};
    await Promise.all(
      channelsConfig.channels.map(async (channel) => {
        const platformStatuses = await Promise.all(
          channel.platforms.map(async (platform) => [
            platform.type,
            platform.type === "twitch"
              ? await checkTwitchStatus(channel)
              : platform.type === "youtube"
                ? await checkYoutubeStatus(platform)
                : "unknown",
          ]),
        );
        statuses[channel.key] = Object.fromEntries(platformStatuses);
      }),
    );
    updateChannelStatuses(statuses);
    channelUpdated.textContent = new Date().toLocaleString("zh-TW");
    const hasUnknownStatus = Object.values(statuses).some((platformStatuses) =>
      Object.values(platformStatuses).includes("unknown"),
    );
    channelStatusMessage.hidden = !hasUnknownStatus;
    channelStatusMessage.textContent = hasUnknownStatus
      ? "部分頻道狀態未知；平台或公開代理可能暫時無法使用。"
      : "";
  };

  const loadChannelStatuses = async () => {
    const endpoint = channelsConfig.statusEndpoint.trim();
    if (!endpoint) {
      await loadPublicStatuses();
      return;
    }

    channelStatusMessage.hidden = true;
    channelStatusMessage.textContent = "";
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(endpoint, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`頻道狀態服務回應錯誤：HTTP ${response.status}`);
      }
      const result = await response.json();
      if (
        typeof result.checkedAt !== "string" ||
        !result.statuses ||
        typeof result.statuses !== "object"
      ) {
        throw new Error("頻道狀態服務回傳的資料格式無效。");
      }
      updateChannelStatuses(result.statuses);
      channelUpdated.textContent = new Date(result.checkedAt).toLocaleString("zh-TW");
      const hasErrors = Array.isArray(result.errors) && result.errors.length > 0;
      channelStatusMessage.hidden = !hasErrors;
      channelStatusMessage.textContent = hasErrors
        ? "部分平台狀態暫時無法取得，未知狀態不會列為離線。"
        : "";
    } catch (error) {
      channelStatusMessage.hidden = false;
      if (error.name === "AbortError") {
        console.warn("推薦頻道狀態查詢逾時。");
        channelStatusMessage.textContent = "狀態查詢逾時；請稍後再試。";
      } else {
        console.error("無法讀取推薦頻道狀態。", error);
        channelStatusMessage.textContent = "狀態服務暫時無法使用；未知狀態不會列為離線。";
      }
      channelUpdated.textContent = "未成功更新";
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const refreshChannelStatuses = async () => {
    if (channelRefreshButton.disabled) return;
    channelRefreshButton.disabled = true;
    channelRefreshButton.setAttribute("aria-busy", "true");
    try {
      await loadChannelStatuses();
    } catch (error) {
      console.error("推薦頻道狀態更新時發生未預期錯誤。", error);
      channelStatusMessage.hidden = false;
      channelStatusMessage.textContent = "直播狀態暫時無法更新；頻道清單仍可瀏覽。";
    } finally {
      channelRefreshButton.disabled = false;
      channelRefreshButton.removeAttribute("aria-busy");
    }
  };

  channelRefreshButton.addEventListener("click", () => {
    void refreshChannelStatuses();
  });

  renderCounts();
  window.dispatchEvent(
    new CustomEvent("page-content-ready", {
      detail: {
        page: "recommend",
        part: "channels",
        items: channelsConfig.channels.length,
      },
    }),
  );
  void refreshChannelStatuses();
}
