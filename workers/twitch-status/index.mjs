import "../../recommend/channels-config.js";

const TWITCH_CHANNEL = "hakkanekolive2d";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const TWITCH_STREAMS_URL = "https://api.twitch.tv/helix/streams";
const YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const TWITCH_REQUEST_TIMEOUT_MS = 8000;
const CHANNEL_STATUS_CACHE_MS =
  Math.max(60, Number(globalThis.CHANNELS_CONFIG.statusRefreshMinutes) || 60) * 60 * 1000;

let cachedToken = null;
let tokenRequest = null;
let cachedChannelStatuses = null;
let channelStatusRequest = null;

const allowedOrigins = (env) =>
  (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const makeJsonResponse = (body, status, origin) => {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
};

const fetchTwitch = async (input, init = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TWITCH_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const getAppAccessToken = async (env) => {
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    throw new Error("Twitch API credentials are not configured.");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  if (tokenRequest) {
    return tokenRequest;
  }

  tokenRequest = (async () => {
    try {
      const response = await fetchTwitch(TWITCH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.TWITCH_CLIENT_ID,
          client_secret: env.TWITCH_CLIENT_SECRET,
          grant_type: "client_credentials",
        }),
      });
      if (!response.ok) {
        throw new Error(`Twitch OAuth token request failed with HTTP ${response.status}.`);
      }
      const result = await response.json();
      if (typeof result.access_token !== "string" || !Number.isFinite(result.expires_in)) {
        throw new Error("Twitch OAuth returned an invalid app access token.");
      }
      cachedToken = {
        value: result.access_token,
        expiresAt: Date.now() + Math.max(0, result.expires_in - 60) * 1000,
      };
      return cachedToken.value;
    } finally {
      tokenRequest = null;
    }
  })();

  return tokenRequest;
};

const getLiveStream = async (env) => {
  const token = await getAppAccessToken(env);
  const url = new URL(TWITCH_STREAMS_URL);
  url.searchParams.set("user_login", TWITCH_CHANNEL);
  const response = await fetchTwitch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": env.TWITCH_CLIENT_ID,
    },
  });
  if (!response.ok) {
    throw new Error(`Twitch streams request failed with HTTP ${response.status}.`);
  }
  const result = await response.json();
  if (!Array.isArray(result.data)) {
    throw new Error("Twitch streams response did not contain a data array.");
  }
  return result.data[0] || null;
};

const getLiveStreams = async (env) => {
  const logins = globalThis.CHANNELS_CONFIG.twitch;
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) {
    throw new Error("Twitch API credentials are not configured.");
  }
  const token = await getAppAccessToken(env);
  const url = new URL(TWITCH_STREAMS_URL);
  logins.forEach((login) => url.searchParams.append("user_login", login));
  const response = await fetchTwitch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": env.TWITCH_CLIENT_ID,
    },
  });
  if (!response.ok) {
    throw new Error(`Twitch streams request failed with HTTP ${response.status}.`);
  }
  const result = await response.json();
  if (!Array.isArray(result.data)) {
    throw new Error("Twitch streams response did not contain a data array.");
  }
  return result.data;
};

const getYoutubeChannelId = async (platform, env) => {
  if (platform.youtubeChannelId) return platform.youtubeChannelId;
  const url = new URL(YOUTUBE_CHANNELS_URL);
  url.searchParams.set("part", "id");
  url.searchParams.set("forHandle", platform.label.replace(/^@/, ""));
  url.searchParams.set("key", env.YOUTUBE_API_KEY);
  const response = await fetchTwitch(url);
  if (!response.ok) {
    throw new Error(`YouTube channel lookup failed with HTTP ${response.status}.`);
  }
  const result = await response.json();
  if (!Array.isArray(result.items) || typeof result.items[0]?.id !== "string") {
    throw new Error(`YouTube did not return a channel for ${platform.label}.`);
  }
  return result.items[0].id;
};

const isYoutubeChannelLive = async (platform, env) => {
  const channelId = await getYoutubeChannelId(platform, env);
  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "id");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("eventType", "live");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("key", env.YOUTUBE_API_KEY);
  const response = await fetchTwitch(url);
  if (!response.ok) {
    throw new Error(`YouTube live lookup failed with HTTP ${response.status}.`);
  }
  const result = await response.json();
  if (!Array.isArray(result.items)) {
    throw new Error("YouTube live lookup did not return an items array.");
  }
  return result.items.length > 0;
};

const getChannelStatuses = async (env) => {
  const statuses = Object.fromEntries(
    globalThis.CHANNELS_CONFIG.channels.map((channel) => [
      channel.key,
      Object.fromEntries(channel.platforms.map((platform) => [platform.type, "unknown"])),
    ]),
  );
  const errors = [];
  let knownStatuses = 0;

  try {
    const liveLogins = new Set(
      (await getLiveStreams(env)).map((stream) => String(stream.user_login).toLowerCase()),
    );
    globalThis.CHANNELS_CONFIG.twitch.forEach((login) => {
      const channel = globalThis.CHANNELS_CONFIG.channels.find((entry) =>
        entry.platforms.some(
          (platform) => platform.type === "twitch" && platform.label.toLowerCase() === login.toLowerCase(),
        ),
      );
      if (!channel) {
        throw new Error(`Twitch login ${login} is missing from the channel configuration.`);
      }
      statuses[channel.key].twitch = liveLogins.has(login.toLowerCase()) ? "online" : "offline";
      knownStatuses += 1;
    });
  } catch (error) {
    console.error("Unable to retrieve Twitch recommendation statuses.", error);
    errors.push("twitch");
  }

  if (!env.YOUTUBE_API_KEY) {
    errors.push("youtube");
  } else {
    await Promise.all(
      globalThis.CHANNELS_CONFIG.youtube.map(async (handle) => {
        const channel = globalThis.CHANNELS_CONFIG.channels.find((entry) =>
          entry.platforms.some(
            (platform) =>
              platform.type === "youtube" && platform.label.toLowerCase() === handle.toLowerCase(),
          ),
        );
        if (!channel) {
          console.error(`YouTube handle ${handle} is missing from the channel configuration.`);
          errors.push("youtube");
          return;
        }
        const platform = channel.platforms.find(
          (entry) =>
            entry.type === "youtube" && entry.label.toLowerCase() === handle.toLowerCase(),
        );
        try {
          statuses[channel.key].youtube = (await isYoutubeChannelLive(platform, env))
            ? "online"
            : "offline";
          knownStatuses += 1;
        } catch (error) {
          console.error(`Unable to retrieve YouTube status for ${handle}.`, error);
          errors.push("youtube");
        }
      }),
    );
  }

  if (knownStatuses === 0) {
    throw new Error("No recommendation channel statuses could be retrieved.");
  }
  return {
    checkedAt: new Date().toISOString(),
    statuses,
    errors: [...new Set(errors)],
  };
};

const loadChannelStatuses = async (env) => {
  const cacheKey = [
    Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET),
    Boolean(env.YOUTUBE_API_KEY),
  ].join(":");
  if (cachedChannelStatuses?.key === cacheKey && cachedChannelStatuses.expiresAt > Date.now()) {
    return cachedChannelStatuses.value;
  }
  if (channelStatusRequest) return channelStatusRequest;

  channelStatusRequest = (async () => {
    try {
      const value = await getChannelStatuses(env);
      cachedChannelStatuses = {
        key: cacheKey,
        value,
        expiresAt: Date.now() + CHANNEL_STATUS_CACHE_MS,
      };
      return value;
    } finally {
      channelStatusRequest = null;
    }
  })();
  return channelStatusRequest;
};

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const isAllowedOrigin = !origin || allowedOrigins(env).includes(origin);
    if (!isAllowedOrigin) {
      return makeJsonResponse({ error: "Origin not allowed." }, 403, null);
    }

    if (request.method === "OPTIONS") {
      return makeJsonResponse(null, 204, origin);
    }
    if (request.method !== "GET") {
      return makeJsonResponse({ error: "Method not allowed." }, 405, origin);
    }

    const path = new URL(request.url).pathname;
    if (path === "/api/channels-status") {
      try {
        return makeJsonResponse(await loadChannelStatuses(env), 200, origin);
      } catch (error) {
        console.error("Recommendation channel status lookup failed.", error);
        return makeJsonResponse(
          { error: "Recommendation channel status is temporarily unavailable." },
          503,
          origin,
        );
      }
    }

    if (path !== "/api/twitch-status") {
      return makeJsonResponse({ error: "Not found." }, 404, origin);
    }

    try {
      const stream = await getLiveStream(env);
      return makeJsonResponse(
        {
          channel: TWITCH_CHANNEL,
          online: Boolean(stream),
          checkedAt: new Date().toISOString(),
        },
        200,
        origin,
      );
    } catch (error) {
      console.error("Twitch live status lookup failed.", error);
      return makeJsonResponse({ error: "Twitch live status is temporarily unavailable." }, 503, origin);
    }
  },
};
