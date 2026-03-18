import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "/js/config/firebase.js";

function hideStaffAccountsNavItem() {
  const staffAccountsLink = document.querySelector(
    '.sidebar nav a[href="/pages/staff_accounts/staff_accounts.html"]',
  );
  const li = staffAccountsLink?.closest("li");
  if (li) li.style.display = "none";
}

function cacheRole(role, isApproved) {
  try {
    localStorage.setItem("peso-admin-role", String(role || ""));
    localStorage.setItem("peso-admin-approved", isApproved ? "1" : "0");
  } catch {
    /* ignore */
  }
}

async function applySidebarVisibility(user) {
  if (!user) return;

  try {
    const snap = await getDoc(doc(db, "adminUsers", user.uid));
    if (!snap.exists()) return;
    const data = snap.data();

    const role = data?.role;
    const isApproved = data?.isApproved === true;

    // Approved staff should not see Staff Accounts in the sidebar
    if (role === "staff" && isApproved) {
      cacheRole(role, isApproved);
      hideStaffAccountsNavItem();
    }
  } catch {
    /* ignore sidebar personalization errors */
  }
}

onAuthStateChanged(auth, (user) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      applySidebarVisibility(user),
    );
  } else {
    applySidebarVisibility(user);
  }
});
