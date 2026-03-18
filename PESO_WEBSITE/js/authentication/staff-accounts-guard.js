import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "/js/config/firebase.js";

const DASHBOARD_URL = "/pages/dashboard/dashboard.html";
const LOGIN_URL = "/pages/login/login.html";

function redirect(url) {
  try {
    window.location.replace(url);
  } catch {
    window.location.href = url;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    redirect(LOGIN_URL);
    return;
  }

  try {
    const snap = await getDoc(doc(db, "adminUsers", user.uid));
    if (!snap.exists()) return;

    const data = snap.data();
    const role = data?.role;
    const isApproved = data?.isApproved === true;

    // Cache for instant sidebar personalization on subsequent pages
    try {
      localStorage.setItem("peso-admin-role", String(role || ""));
      localStorage.setItem("peso-admin-approved", isApproved ? "1" : "0");
    } catch {
      /* ignore */
    }

    // Approved staff should not access Staff Accounts page
    if (role === "staff" && isApproved) {
      redirect(DASHBOARD_URL);
    }
  } catch {
    /* ignore */
  }
});
