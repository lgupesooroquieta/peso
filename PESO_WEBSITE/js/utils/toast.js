/**
 * Toast notification – top-right, matches applicants page design
 * Usage: window.showToast("Saved changes", "success")
 */
(function () {
  function init() {
    // Inject CSS styles (same as applicants page)
    if (!document.getElementById("toast-styles")) {
      const style = document.createElement("style");
      style.id = "toast-styles";
      style.textContent = `
        .toast-container {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          gap: 12px;
          pointer-events: none;
        }

        .toast-item {
          --toast-duration: 4000ms;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 300px;
          max-width: 420px;
          padding: 16px 20px;
          border-radius: 6px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          background: var(--color-bg-card);
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-primary);
          font-size: 15px;
          font-weight: 500;
          pointer-events: auto;
          animation: toastSlideIn 0.4s ease-out;
          position: relative;
          overflow: hidden;
        }

        [data-theme="dark"] .toast-item {
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        /* Override any page-level toast CSS that adds a left color strip */
        .toast-item.toast-success,
        .toast-item.toast-error,
        .toast-item.toast-info {
          border-left: none !important;
        }

        .toast-item.toast-success .toast-icon {
          color: var(--badge-success-text);
        }

        .toast-item.toast-error .toast-icon {
          color: var(--badge-danger-text);
        }

        .toast-item.toast-info .toast-icon {
          color: var(--badge-info-text);
        }

        .toast-icon {
          flex-shrink: 0;
          font-size: 20px;
        }

        .toast-message {
          flex: 1;
          margin: 0;
        }

        .toast-progress {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 4px;
          background: rgba(0, 0, 0, 0.08);
        }

        [data-theme="dark"] .toast-progress {
          background: rgba(255, 255, 255, 0.12);
        }

        .toast-progress-bar {
          height: 100%;
          width: 100%;
          background: var(--badge-success-text, #28a745);
          transform-origin: left center;
          animation: toastProgress var(--toast-duration) linear forwards;
        }

        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes toastProgress {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Ensure container exists (support both IDs for compatibility)
    let container =
      document.getElementById("toastContainer") ||
      document.getElementById("toast-container");

    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      container.setAttribute("aria-live", "polite");
      document.body.appendChild(container);
    } else {
      if (!container.classList.contains("toast-container"))
        container.classList.add("toast-container");
      if (!container.getAttribute("aria-live"))
        container.setAttribute("aria-live", "polite");
    }
  }

  function showToast(message, type = "success", durationMs = 4000) {
    init();

    const container =
      document.getElementById("toastContainer") ||
      document.getElementById("toast-container");
    if (!container) return;

    const icons = {
      success: "fa-check-circle",
      error: "fa-times-circle",
      info: "fa-info-circle",
    };
    const icon = icons[type] || icons.success;

    const el = document.createElement("div");
    el.className = `toast-item toast-${type}`;
    el.setAttribute("role", "alert");
    el.style.setProperty(
      "--toast-duration",
      `${Math.max(800, Number(durationMs) || 4000)}ms`,
    );

    const iconEl = document.createElement("i");
    iconEl.className = `fas ${icon} toast-icon`;

    const msgEl = document.createElement("p");
    msgEl.className = "toast-message";
    msgEl.textContent = String(message);

    const progress = document.createElement("div");
    progress.className = "toast-progress";

    const progressBar = document.createElement("div");
    progressBar.className = "toast-progress-bar";

    progress.appendChild(progressBar);
    el.appendChild(iconEl);
    el.appendChild(msgEl);
    el.appendChild(progress);
    container.appendChild(el);

    const remove = () => {
      el.style.transition = "opacity 0.25s, transform 0.25s";
      el.style.opacity = "0";
      el.style.transform = "translateX(100%)";
      setTimeout(() => el.remove(), 250);
    };

    setTimeout(remove, Math.max(800, Number(durationMs) || 4000));
  }

  window.showToast = showToast;
})();
