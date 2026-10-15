import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index.mjs";

const env = {
  ALLOWED_ORIGINS: "https://hakkanekolive2d.cc",
  TWITCH_CLIENT_ID: "test-client-id",
  TWITCH_CLIENT_SECRET: "test-client-secret",
};

const withMockFetch = async (t, handler) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
};

test("returns an online status and allows the configured site origin", async (t) => {
  await withMockFetch(t, async (input) => {
    if (String(input) === "https://id.twitch.tv/oauth2/token") {
      return Response.json({ access_token: "test-token", expires_in: 3600 });
    }
    return Response.json({
      data: [{
        title: "Live drawing",
        game_name: "Art",
        viewer_count: 12,
        started_at: "2025-01-01T00:00:00Z",
      }],
    });
  });

  const response = await worker.fetch(
    new Request("https://worker.example/api/twitch-status", {
      headers: { Origin: "https://hakkanekolive2d.cc" },
    }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://hakkanekolive2d.cc");
  const { checkedAt, ...payload } = await response.json();
  assert.equal(typeof checkedAt, "string");
  assert.deepEqual(payload, {
    channel: "hakkanekolive2d",
    online: true,
  });
});

test("returns an offline status when Twitch has no active stream", async (t) => {
  await withMockFetch(t, async (input) => {
    if (String(input) === "https://id.twitch.tv/oauth2/token") {
      return Response.json({ access_token: "test-token", expires_in: 3600 });
    }
    return Response.json({ data: [] });
  });

  const response = await worker.fetch(
    new Request("https://worker.example/api/twitch-status", {
      headers: { Origin: "https://hakkanekolive2d.cc" },
    }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).online, false);
});

test("rejects unconfigured origins without calling Twitch", async (t) => {
  let called = false;
  await withMockFetch(t, async () => {
    called = true;
    throw new Error("Unexpected Twitch request.");
  });

  const response = await worker.fetch(
    new Request("https://worker.example/api/twitch-status", {
      headers: { Origin: "https://untrusted.example" },
    }),
    env,
  );

  assert.equal(response.status, 403);
  assert.equal(called, false);
});

test("returns an explicit service error when Twitch credentials are missing", async (t) => {
  const originalConsoleError = console.error;
  console.error = () => {};
  t.after(() => {
    console.error = originalConsoleError;
  });
  await withMockFetch(t, async () => {
    throw new Error("Unexpected Twitch request.");
  });

  const response = await worker.fetch(
    new Request("https://worker.example/api/twitch-status"),
    { ALLOWED_ORIGINS: "" },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Twitch live status is temporarily unavailable.",
  });
});

test("returns configured Twitch and YouTube recommendation statuses", async (t) => {
  await withMockFetch(t, async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "id.twitch.tv") {
      return Response.json({ access_token: "test-token", expires_in: 3600 });
    }
    if (url.hostname === "api.twitch.tv") {
      assert.deepEqual(
        url.searchParams.getAll("user_login"),
        globalThis.CHANNELS_CONFIG.twitch,
      );
      return Response.json({ data: [{ user_login: "bunny0422" }] });
    }
    if (url.pathname.endsWith("/youtube/v3/channels")) {
      return Response.json({
        items: [{ id: `UC_${url.searchParams.get("forHandle")}` }],
      });
    }
    if (url.pathname.endsWith("/youtube/v3/search")) {
      return Response.json({
        items: url.searchParams.get("channelId") === "UC_MurichanChannel"
          ? [{ id: { videoId: "test-live-video" } }]
          : [],
      });
    }
    throw new Error(`Unexpected upstream request: ${url.hostname}${url.pathname}`);
  });

  const response = await worker.fetch(
    new Request("https://worker.example/api/channels-status", {
      headers: { Origin: "https://hakkanekolive2d.cc" },
    }),
    { ...env, YOUTUBE_API_KEY: "test-youtube-key" },
  );

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.statuses.bunny0422, { twitch: "online" });
  assert.deepEqual(result.statuses.yazawaribii, { twitch: "offline" });
  assert.deepEqual(result.statuses.MurichanChannel, { youtube: "online" });
  assert.deepEqual(result.statuses.darkmeyaya, { twitch: "offline", youtube: "offline" });
  assert.deepEqual(result.statuses.emotvvv, { youtube: "offline" });
  assert.deepEqual(result.statuses.mo_chan_neko, { twitch: "offline" });
  assert.deepEqual(result.errors, []);
});

test("returns Twitch statuses with YouTube marked unknown when its API key is missing", async (t) => {
  await withMockFetch(t, async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.twitch.tv") {
      return Response.json({ data: [] });
    }
    throw new Error(`Unexpected upstream request: ${url.hostname}${url.pathname}`);
  });

  const response = await worker.fetch(
    new Request("https://worker.example/api/channels-status"),
    env,
  );

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.statuses.bunny0422, { twitch: "offline" });
  assert.deepEqual(result.statuses.MurichanChannel, { youtube: "unknown" });
  assert.deepEqual(result.errors, ["youtube"]);
});

test("returns not found for unrecognized API paths", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/unknown"),
    env,
  );

  assert.equal(response.status, 404);
});
