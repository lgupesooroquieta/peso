import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";

const loginForm = document.getElementById("loginForm");
const loginBtn = document.querySelector(".btn-login");

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

      console.log("Login Successful", user.uid);

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
      }

      alert(errorMessage);

      loginBtn.disabled = false;
      loginBtn.textContent = "Sign In";
    }
  });
}
