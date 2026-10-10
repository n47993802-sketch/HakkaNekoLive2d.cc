const hakkaSystemTheme = () => {
  const preference = window.matchMedia?.("(prefers-color-scheme: dark)");
  return preference?.matches ? "night" : "day";
};

try {
  const hakkaThemeInitSystemQuery = window.matchMedia?.(
    "(prefers-color-scheme: dark)",
  );
  const hakkaSavedTheme = window.localStorage.getItem("hakka-theme");
  const hakkaHasSavedTheme =
    hakkaSavedTheme === "night" || hakkaSavedTheme === "day";
  document.documentElement.dataset.theme = hakkaHasSavedTheme
    ? hakkaSavedTheme
    : hakkaThemeInitSystemQuery?.matches
      ? "night"
      : "day";
  document.documentElement.dataset.themePreference = hakkaHasSavedTheme
    ? "user"
    : "system";
} catch (error) {
  console.warn("無法讀取日夜模式偏好。", error);
  document.documentElement.dataset.theme = hakkaSystemTheme();
  document.documentElement.dataset.themePreference = "system";
}

try {
  const pageLoaderSeenKey = "hakka-page-loader-seen";
  if (window.sessionStorage.getItem(pageLoaderSeenKey) === "true") {
    document.documentElement.dataset.pageLoaderSeen = "true";
  } else {
    window.sessionStorage.setItem(pageLoaderSeenKey, "true");
  }
} catch (error) {
  console.warn("無法讀取頁面載入狀態；本次仍會顯示載入畫面。", error);
}
