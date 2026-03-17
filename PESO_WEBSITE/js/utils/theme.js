// Light / dark mode toggle for PESO admin pages
(function () {
  const STORAGE_KEY = "peso-admin-theme";

  function getInitialTheme() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        return stored;
      }
    } catch (_) {
      // Ignore storage errors (e.g. private mode)
    }

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }

  function applyTheme(theme) {
    var root = document.documentElement;
    root.classList.add("theme-switching");
    root.setAttribute("data-theme", theme);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.remove("theme-switching");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggleBtn = document.querySelector(".theme-toggle-btn");
    var currentTheme = getInitialTheme();

    applyTheme(currentTheme);

    function syncToggleAppearance(theme) {
      if (!toggleBtn) return;
      var icon = toggleBtn.querySelector("i");
      if (!icon) return;

      if (theme === "dark") {
        icon.classList.remove("fa-moon");
        icon.classList.add("fa-sun");
        toggleBtn.setAttribute("aria-label", "Switch to light mode");
      } else {
        icon.classList.remove("fa-sun");
        icon.classList.add("fa-moon");
        toggleBtn.setAttribute("aria-label", "Switch to dark mode");
      }
    }

    syncToggleAppearance(currentTheme);

    if (!toggleBtn) return;

    toggleBtn.addEventListener("click", function () {
      currentTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(currentTheme);
      syncToggleAppearance(currentTheme);

      try {
        localStorage.setItem(STORAGE_KEY, currentTheme);
      } catch (_) {
        // Ignore storage errors
      }

      try {
        window.dispatchEvent(
          new CustomEvent("theme-changed", { detail: { theme: currentTheme } }),
        );
      } catch (_) {
        // Ignore
      }
    });
  });
})();
