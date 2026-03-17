/**
 * Dashboard entry: auth check, then run counts immediately and load carousels in parallel.
 * Counts use static import so they run without waiting for extra script fetches.
 */
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";
import { init as initCounts } from "./dashboard-counts.js";

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/pages/login/login.html";
    return;
  }
  document.documentElement.classList.remove("auth-pending");

  const mainContent = document.querySelector(".main-content");
  if (mainContent) {
    mainContent.classList.add("dashboard-loading");
  }

  const revealContent = () => {
    if (mainContent) {
      mainContent.classList.remove("dashboard-loading");
      mainContent.classList.add("dashboard-loaded");
    }
    if (window.LoadingOverlay) LoadingOverlay.hide();
  };

  Promise.all([
    initCounts(),
    import("./dashboard-announcements.js").then((m) => m.init()),
    import("./dashboard-programs.js").then((m) => m.init()),
  ])
    .then(() => {
      // Double rAF + delay to ensure DOM is painted before hiding skeleton
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(revealContent, 100);
        });
      });
    })
    .catch((e) => {
      console.error("Dashboard load error:", e);
      revealContent();
    });
});
