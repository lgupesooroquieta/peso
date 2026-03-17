/**
 * Route guard: protects pages that require login and redirects appropriately.
 * - On protected pages (e.g. dashboard, announcements): redirect to login if not authenticated.
 * - On login page: redirect to dashboard if already authenticated.
 * Include this script first (type="module") on every page that needs auth checks.
 */
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";

const LOGIN_URL = "/pages/login/login.html";
const DASHBOARD_URL = "/pages/dashboard/dashboard.html";

function isLoginPage() {
  const path = window.location.pathname || "";
  return (
    path.includes("login") &&
    (path.endsWith("login.html") || path.endsWith("/login"))
  );
}

function isProtectedPage() {
  const path = window.location.pathname || "";
  // Protected: any page under /pages/ except login (and optionally signup)
  if (!path.includes("/pages/")) return false;
  if (path.includes("login")) return false;
  if (path.includes("signup")) return false;
  return true;
}

export function initAuthGuard() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (isLoginPage()) {
        if (user) {
          window.location.replace(DASHBOARD_URL);
          return;
        }
        resolve(user);
        return;
      }

      if (isProtectedPage()) {
        if (!user) {
          window.location.replace(LOGIN_URL);
          return;
        }
        document.documentElement.classList.remove("auth-pending");
        resolve(user);
        return;
      }

      resolve(user);
    });
  });
}

// Run guard when script loads (for pages that include this module)
initAuthGuard();
