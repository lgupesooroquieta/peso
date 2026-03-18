/**
 * Logout: confirmation modal + Firebase signOut, then redirect to login.
 * Attaches to links with class .exit-link.
 */
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";

const LOGIN_URL = "/pages/login/login.html";

(function () {
  document.addEventListener("DOMContentLoaded", function () {
    const exitLinks = document.querySelectorAll(".exit-link");
    if (!exitLinks.length) return;

    if (!document.getElementById("logout-confirm-styles")) {
      const style = document.createElement("style");
      style.id = "logout-confirm-styles";
      style.textContent = `
        .logout-confirm-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          z-index: 1050;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .logout-confirm-overlay.open {
          display: flex;
        }

        .logout-confirm-box {
          background: var(--color-bg-card);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border-subtle);
          border-radius: 16px;
          max-width: 360px;
          width: 100%;
          box-shadow: var(--shadow-card);
          overflow: hidden;
        }

        .logout-confirm-header {
          background: var(--color-bg-elevated);
          color: var(--color-text-heading);
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-bottom: 1px solid var(--color-border-subtle);
        }

        .logout-confirm-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .logout-confirm-header i {
          color: var(--color-icon-active);
        }

        .logout-confirm-message {
          padding: 24px 24px 8px;
          margin: 0;
          font-size: 15px;
          color: var(--color-text-muted);
          text-align: center;
        }

        .logout-confirm-actions {
          padding: 16px 24px 24px;
          display: flex;
          justify-content: center;
          gap: 12px;
        }

        .logout-confirm-actions .btn {
          border-radius: 10px;
          font-size: 14px;
          padding: 8px 20px;
        }
      `;
      document.head.appendChild(style);
    }

    let overlay = document.getElementById("logoutConfirmOverlay");
    if (!overlay) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `
        <div id="logoutConfirmOverlay" class="logout-confirm-overlay" aria-hidden="true">
          <div class="logout-confirm-box" role="dialog" aria-modal="true" aria-labelledby="logoutConfirmTitle">
            <div class="logout-confirm-header">
              <i class="fas fa-sign-out-alt"></i>
              <h3 id="logoutConfirmTitle">Log out</h3>
            </div>
            <p class="logout-confirm-message">Are you sure to log out?</p>
            <div class="logout-confirm-actions">
              <button type="button" class="btn btn-outline-secondary" id="logoutCancelBtn">
                Cancel
              </button>
              <button type="button" class="btn btn-danger" id="logoutConfirmBtn">
                <i class="fas fa-sign-out-alt"></i> Log out
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(wrapper.firstElementChild);
      overlay = document.getElementById("logoutConfirmOverlay");
    }

    if (!overlay) return;

    const cancelBtn = overlay.querySelector("#logoutCancelBtn");
    const confirmBtn = overlay.querySelector("#logoutConfirmBtn");
    let pending = false;

    function openModal() {
      pending = true;
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      pending = false;
    }

    function doLogout() {
      signOut(auth)
        .then(() => {
          try {
            localStorage.removeItem("peso-admin-role");
            localStorage.removeItem("peso-admin-approved");
          } catch (_) {}
          window.location.href = LOGIN_URL;
        })
        .catch((err) => {
          console.error("Logout error:", err);
          try {
            localStorage.removeItem("peso-admin-role");
            localStorage.removeItem("peso-admin-approved");
          } catch (_) {}
          window.location.href = LOGIN_URL;
        });
    }

    exitLinks.forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (event.button === 1 || event.ctrlKey || event.metaKey) return;

        event.preventDefault();
        openModal();
      });
    });

    if (cancelBtn) {
      cancelBtn.addEventListener("click", closeModal);
    }

    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        if (pending) {
          closeModal();
          doLogout();
        }
      });
    }

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeModal();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && overlay.classList.contains("open")) {
        closeModal();
      }
    });
  });
})();
