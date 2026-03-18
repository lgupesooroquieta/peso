import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "/js/config/firebase.js";
import { showApprovalModal } from "/js/authentication/register.js";

// Redirect to dashboard if already logged in, email verified, and (for staff) approved.
// This prevents a just-created, unverified account from being auto-redirected.
onAuthStateChanged(auth, async (user) => {
  if (!user || !window.location.pathname.includes("login")) return;

  // Do not auto-redirect if email is not verified
  if (!user.emailVerified) {
    return;
  }

  try {
    const adminUserSnap = await getDoc(doc(db, "adminUsers", user.uid));
    if (!adminUserSnap.exists()) return;
    const data = adminUserSnap.data();
    if (data.role === "staff" && data.isApproved !== true) return;
    window.location.replace("/pages/dashboard/dashboard.html");
  } catch {
    /* ignore */
  }
});

const loginForm = document.getElementById("loginForm");
const loginBtn = document.querySelector(".btn-login");
const verificationModal = document.getElementById("verificationModal");
const loginStatusModal = document.getElementById("loginStatusModal");
const loginStatusModalTitle = document.getElementById("loginStatusModalTitle");
const loginStatusModalMessage = document.getElementById(
  "loginStatusModalMessage",
);
const loginStatusModalClose = document.getElementById("loginStatusModalClose");

function openVerificationModal() {
  if (!verificationModal) return;
  verificationModal.classList.add("open");
  verificationModal.setAttribute("aria-hidden", "false");
}

function openLoginStatusModal(options) {
  if (!loginStatusModal || !loginStatusModalTitle || !loginStatusModalMessage) {
    return;
  }

  const { title, message, variant } = options;

  loginStatusModalTitle.textContent = title || "There was a problem";
  loginStatusModalMessage.textContent =
    message || "Something went wrong. Please try again.";

  const card = loginStatusModal.querySelector(".login-status-modal-card");
  if (card) {
    card.classList.remove(
      "login-status-modal--error",
      "login-status-modal--warning",
      "login-status-modal--info",
    );
    if (variant === "warning") {
      card.classList.add("login-status-modal--warning");
    } else if (variant === "info") {
      card.classList.add("login-status-modal--info");
    } else {
      card.classList.add("login-status-modal--error");
    }
  }

  loginStatusModal.classList.add("open");
  loginStatusModal.setAttribute("aria-hidden", "false");
}

function closeLoginStatusModal() {
  if (!loginStatusModal) return;
  loginStatusModal.classList.remove("open");
  loginStatusModal.setAttribute("aria-hidden", "true");
}

if (loginStatusModalClose) {
  loginStatusModalClose.addEventListener("click", () => {
    closeLoginStatusModal();
  });
}

if (loginStatusModal) {
  const backdrop = loginStatusModal.querySelector(".signup-modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", () => {
      closeLoginStatusModal();
    });
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLoginStatusModal();
  }
});

// Password visibility toggle
const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("passwordToggle");
if (passwordToggle && passwordInput) {
  passwordToggle.addEventListener("click", () => {
    const iconEye = passwordToggle.querySelector(".icon-eye");
    const iconEyeOff = passwordToggle.querySelector(".icon-eye-off");
    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      passwordToggle.setAttribute("title", "Hide password");
      passwordToggle.setAttribute("aria-label", "Hide password");
      if (iconEye) iconEye.style.display = "none";
      if (iconEyeOff) iconEyeOff.style.display = "block";
    } else {
      passwordInput.type = "password";
      passwordToggle.setAttribute("title", "Show password");
      passwordToggle.setAttribute("aria-label", "Show password");
      if (iconEye) iconEye.style.display = "block";
      if (iconEyeOff) iconEyeOff.style.display = "none";
    }
  });
}

if (loginForm && loginBtn) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const user = userCredential.user;

      // Require verified email before accessing the admin dashboard
      if (!user.emailVerified) {
        await signOut(auth);
        openVerificationModal();
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign In";
        return;
      }

      const adminUserRef = doc(db, "adminUsers", user.uid);
      const adminUserSnap = await getDoc(adminUserRef);

      if (!adminUserSnap.exists()) {
        await signOut(auth);
        alert("This account is not authorized to access the admin dashboard.");
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign In";
        return;
      }

      const adminUser = adminUserSnap.data();
      const role = adminUser.role;
      const isApproved = adminUser.isApproved === true;

      if (role === "staff" && !isApproved) {
        await signOut(auth);
        openLoginStatusModal({
          title: "Account pending approval",
          message:
            "Your staff account needs to be approved by an administrator before you can sign in.",
          variant: "warning",
        });
        loginBtn.disabled = false;
        loginBtn.textContent = "Sign In";
        return;
      }

      // Cache role/approval so sidebar can hide items immediately on next pages
      try {
        localStorage.setItem("peso-admin-role", String(role || ""));
        localStorage.setItem("peso-admin-approved", isApproved ? "1" : "0");
      } catch {
        /* ignore */
      }

      window.location.href = "/pages/dashboard/dashboard.html";
    } catch (error) {
      console.error("Login Error:", error.code, error.message);

      let errorMessage = "An error occurred. Please try again.";

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password"
      ) {
        errorMessage = "Invalid email or password.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled.";
      }

      openLoginStatusModal({
        title: "Sign in failed",
        message: errorMessage,
        variant: error.code === "auth/too-many-requests" ? "warning" : "error",
      });

      loginBtn.disabled = false;
      loginBtn.textContent = "Sign In";
    }
  });
}
