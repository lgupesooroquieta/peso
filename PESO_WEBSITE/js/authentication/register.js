import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "/js/config/firebase.js";
import { ADMIN_SECRET_CODE } from "/js/config/admin-config.js";

const signupModal = document.getElementById("signupModal");
const openSignupLink = document.getElementById("openSignupLink");
const signupModalClose = document.getElementById("signupModalClose");
const signupForm = document.getElementById("signupForm");
const signupSubmitBtn = document.getElementById("signupSubmitBtn");
const signupRole = document.getElementById("signupRole");
const adminCodeGroup = document.getElementById("adminCodeGroup");
const signupAdminCode = document.getElementById("signupAdminCode");
const verificationModal = document.getElementById("verificationModal");
const verificationModalClose = document.getElementById(
  "verificationModalClose",
);
const approvalModal = document.getElementById("approvalModal");
const approvalModalClose = document.getElementById("approvalModalClose");

function openSignupModal() {
  if (!signupModal) return;
  signupModal.classList.add("open");
  signupModal.setAttribute("aria-hidden", "false");
}

function closeSignupModal() {
  if (!signupModal) return;
  signupModal.classList.remove("open");
  signupModal.setAttribute("aria-hidden", "true");
}

/** Close signup and show login form (used after successful registration) */
function showLogin() {
  closeSignupModal();
}

function showVerificationModal() {
  if (!verificationModal) return;
  closeSignupModal();
  verificationModal.classList.add("open");
  verificationModal.setAttribute("aria-hidden", "false");
}

function closeVerificationModal() {
  if (!verificationModal) return;
  verificationModal.classList.remove("open");
  verificationModal.setAttribute("aria-hidden", "true");
}

export function showApprovalModal() {
  if (!approvalModal) return;
  approvalModal.classList.add("open");
  approvalModal.setAttribute("aria-hidden", "false");
}

function closeApprovalModal() {
  if (!approvalModal) return;
  approvalModal.classList.remove("open");
  approvalModal.setAttribute("aria-hidden", "true");
}

// Toggle admin code field when role changes
if (signupRole && adminCodeGroup && signupAdminCode) {
  signupRole.addEventListener("change", () => {
    const isAdmin = signupRole.value === "admin";
    adminCodeGroup.style.display = isAdmin ? "block" : "none";
    signupAdminCode.required = isAdmin;
    if (!isAdmin) signupAdminCode.value = "";
  });
}

if (verificationModalClose) {
  verificationModalClose.addEventListener("click", closeVerificationModal);
}

if (approvalModalClose) {
  approvalModalClose.addEventListener("click", closeApprovalModal);
}

if (openSignupLink && signupModal) {
  openSignupLink.addEventListener("click", (e) => {
    e.preventDefault();
    openSignupModal();
  });
}

if (signupModalClose) {
  signupModalClose.addEventListener("click", closeSignupModal);
}

if (signupModal) {
  signupModal.addEventListener("click", (e) => {
    if (e.target === signupModal) closeSignupModal();
  });
}

if (signupForm && signupSubmitBtn) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("signupName");
    const emailInput = document.getElementById("signupEmail");
    const passwordInput = document.getElementById("signupPassword");

    const name = nameInput?.value.trim();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    const role = signupRole?.value;

    if (!name || !email || !password || !role) {
      alert("Please fill out all fields and select a role.");
      return;
    }

    // Admin flow: validate secret code
    if (role === "admin") {
      const adminCode = signupAdminCode?.value?.trim();
      if (!adminCode || adminCode !== ADMIN_SECRET_CODE) {
        alert("Invalid admin code.");
        return;
      }
    }

    signupSubmitBtn.disabled = true;
    signupSubmitBtn.textContent = "Creating account...";

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const user = userCredential.user;
      const isStaff = role === "staff";

      const adminUserRef = doc(db, "adminUsers", user.uid);
      await setDoc(adminUserRef, {
        uid: user.uid,
        name,
        email,
        role,
        isApproved: isStaff ? false : true,
        createdAt: serverTimestamp(),
      });

      const verifySnap = await getDoc(adminUserRef);
      if (!verifySnap.exists()) {
        throw new Error(
          "Failed to save account to adminUsers. Please try again.",
        );
      }

      await sendEmailVerification(user);
      await signOut(auth);

      signupForm.reset();
      adminCodeGroup.style.display = "none";
      signupAdminCode.required = false;

      // For both admin and staff: require email verification before first login.
      // Account is immediately signed out above; user must verify via email, then sign in.
      showVerificationModal();
    } catch (error) {
      console.error("Signup Error:", error.code, error.message, error);

      let errorMessage = "Unable to create account. Please try again.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already in use.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak. Please choose a stronger one.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
      } else if (
        error.code === "permission-denied" ||
        (error.message && error.message.toLowerCase().includes("permission"))
      ) {
        errorMessage =
          "Permission denied when saving to adminUsers. Deploy Firestore rules: firebase deploy --only firestore:rules";
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    } finally {
      signupSubmitBtn.disabled = false;
      signupSubmitBtn.textContent = "Create account";
    }
  });
}
