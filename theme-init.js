try {
  document.documentElement.dataset.theme =
    window.localStorage.getItem("hakka-theme") === "night" ? "night" : "day";
} catch (error) {
  console.warn("無法讀取日夜模式偏好。", error);
  document.documentElement.dataset.theme = "day";
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
