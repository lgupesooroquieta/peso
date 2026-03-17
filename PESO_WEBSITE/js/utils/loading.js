/**
 * Loading overlay with Lottie cat animation.
 * Use LoadingOverlay.show() and LoadingOverlay.hide() for smooth fade transitions.
 */
(function () {
  let initialized = false;

  window.LoadingOverlay = {
    show: function (container) {
      const el = container || document.getElementById("loadingContainer");
      if (el) el.classList.add("is-visible");
    },
    hide: function (container) {
      const el = container || document.getElementById("loadingContainer");
      if (el) el.classList.remove("is-visible");
    },
  };

  function initLoadingOverlay() {
    const container = document.getElementById("loadingContainer");
    if (!container) return;

    const lottieEl = container.querySelector(".loading-lottie");
    if (!lottieEl) return;

    if (typeof lottie === "undefined") return;
    if (initialized) return;
    initialized = true;

    lottie.loadAnimation({
      container: lottieEl,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path: "/src/lottie/Loading Cat.json",
      rendererSettings: {
        preserveAspectRatio: "xMidYMid meet",
        progressiveLoad: true,
      },
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLoadingOverlay);
  } else {
    initLoadingOverlay();
  }

  if (typeof lottie === "undefined") {
    const checkLottie = setInterval(function () {
      if (typeof lottie !== "undefined") {
        clearInterval(checkLottie);
        initLoadingOverlay();
      }
    }, 100);
    setTimeout(function () {
      clearInterval(checkLottie);
    }, 5000);
  }
})();
