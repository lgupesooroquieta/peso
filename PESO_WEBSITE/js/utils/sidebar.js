(function () {
  const SIDEBAR_COLLAPSED_KEY = "peso-sidebar-collapsed";

  function getSidebarWrapper() {
    return document.querySelector(".sidebar-wrapper");
  }

  function getOverlay() {
    return document.querySelector(".sidebar-overlay");
  }

  function isCollapsed() {
    return getSidebarWrapper().classList.contains("sidebar--collapsed");
  }

  function setCollapsed(collapsed) {
    const wrapper = getSidebarWrapper();
    if (collapsed) {
      wrapper.classList.add("sidebar--collapsed");
      document.body.classList.add("sidebar-collapsed");
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
      } catch (_) {}
    } else {
      wrapper.classList.remove("sidebar--collapsed");
      document.body.classList.remove("sidebar-collapsed");
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "0");
      } catch (_) {}
    }
  }

  function restoreSidebarState() {
    if (window.matchMedia("(min-width: 992px)").matches) {
      try {
        var wrapper = document.querySelector(".sidebar-wrapper");
        if (wrapper && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
          wrapper.classList.add("sidebar--initializing");
          wrapper.classList.add("sidebar--collapsed");
          document.body.classList.add("sidebar-collapsed");
          setTimeout(function () {
            if (wrapper) wrapper.classList.remove("sidebar--initializing");
          }, 300);
        } else if (wrapper) {
          document.body.classList.remove("sidebar-collapsed");
        }
      } catch (_) {}
    } else {
      document.body.classList.remove("sidebar-collapsed");
    }
    try {
      document.documentElement.removeAttribute("data-sidebar-collapsed");
    } catch (_) {}
  }

  function initToggleArrow() {
    const btn = document.querySelector(".sidebar-toggle");
    const wrapper = getSidebarWrapper();
    if (!btn || !wrapper) return;
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setCollapsed(!isCollapsed());
    });
  }

  function initBurgerAndOverlay() {
    const burger = document.querySelector(".burger-btn");
    const overlay = getOverlay();
    const wrapper = getSidebarWrapper();
    if (!wrapper) return;

    function open() {
      wrapper.classList.add("sidebar--open");
      overlay.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      wrapper.classList.remove("sidebar--open");
      overlay.classList.remove("is-open");
      document.body.style.overflow = "";
    }

    if (burger) {
      burger.addEventListener("click", function () {
        if (wrapper.classList.contains("sidebar--open")) close();
        else open();
      });
    }
    if (overlay) {
      overlay.addEventListener("click", close);
    }
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 992) close();
    });
  }

  function initSubmenus() {
    const parents = document.querySelectorAll(
      ".sidebar .nav-item.has-submenu > a",
    );
    parents.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.stopPropagation();
        const li = a.closest(".nav-item");
        if (!li) return;

        const isOpen = li.classList.contains("open");
        document
          .querySelectorAll(".sidebar .nav-item.has-submenu.open")
          .forEach(function (other) {
            if (other !== li) other.classList.remove("open");
          });
        if (isOpen) li.classList.remove("open");
        else li.classList.add("open");

        e.preventDefault();
      });
    });
    document
      .querySelectorAll(
        '.sidebar nav a[href^="/"], .sidebar nav a[href^="http"]',
      )
      .forEach(function (link) {
        if (link.getAttribute("href") === "#") return;
        link.addEventListener("click", function (e) {
          e.stopPropagation();
          if (window.innerWidth < 992) {
            var w = getSidebarWrapper();
            var o = getOverlay();
            if (w && w.classList.contains("sidebar--open")) {
              w.classList.remove("sidebar--open");
              if (o) o.classList.remove("is-open");
              document.body.style.overflow = "";
            }
          }
        });
      });
  }

  function init() {
    if (!getSidebarWrapper()) return;
    initToggleArrow();
    initBurgerAndOverlay();
    initSubmenus();
  }

  restoreSidebarState();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      restoreSidebarState();
      init();
    });
  } else {
    restoreSidebarState();
    init();
  }

  setTimeout(restoreSidebarState, 10);
})();
