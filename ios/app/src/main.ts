import "./compat";
import { failStartup, finishStartup } from "./startup-state";

const isMobile =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
  new URLSearchParams(window.location.search).get("mobile") === "1";

document.documentElement.classList.add(isMobile ? "android-app" : "desktop-app");

if (isMobile) {
  void import("./mobile").catch(failStartup);
  if (import.meta.env.DEV || import.meta.env.VITE_IOS_SELFTEST === '1') void import('./ios-selftest');
} else {
  void import("./desktop").then(finishStartup, failStartup);
}
