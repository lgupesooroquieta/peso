import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Ensure this path points to your shared firebase configuration
import { auth, db } from "/js/config/firebase.js";

// 1. MAIN ENTRY POINT: Wait for Auth BEFORE fetching
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.documentElement.classList.remove("auth-pending");
    loadUser(); // Safe to load now
  } else {
    window.location.href = "/pages/login/login.html";
  }
});

async function loadUser() {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("id");

  // Reset UI
  toggleDisplay("noId", false);
  toggleDisplay("error", false);
  toggleDisplay("panel", false);

  if (!userId) {
    toggleDisplay("loading", false);
    toggleDisplay("noId", true);
    return;
  }

  toggleDisplay("loading", true);

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    toggleDisplay("loading", false);

    if (!userSnap.exists()) {
      showError("User not found in database.");
      return;
    }

    const user = { id: userSnap.id, ...userSnap.data() };
    renderPanel(user);
    toggleDisplay("panel", true);
  } catch (err) {
    toggleDisplay("loading", false);
    console.error("Fetch Error:", err);

    if (err.code === "permission-denied") {
      showError("Access Denied: You do not have permission to view this user.");
    } else {
      showError("Error loading user: " + err.message);
    }
  }
}

// --- HELPER FUNCTIONS ---

function toggleDisplay(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? "block" : "none";
}

function showError(msg) {
  const el = document.getElementById("error");
  if (el) {
    el.textContent = msg;
    el.style.display = "block";
  }
  toggleDisplay("loading", false);
}

function getBadgeClass(typeString) {
  if (!typeString) return "badge-gray";
  const lower = String(typeString).toLowerCase();
  if (
    lower.includes("active") ||
    lower.includes("walk-in") ||
    lower.includes("hired")
  )
    return "badge-green";
  if (lower.includes("pending") || lower.includes("online"))
    return "badge-blue";
  if (lower.includes("banned") || lower.includes("rejected"))
    return "badge-red";
  if (lower.includes("suspended")) return "badge-orange";
  return "badge-gray";
}

function formatValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value.toDate) {
    try {
      const d = value.toDate();
      return d.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch (e) {
      return String(value);
    }
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderRow(label, value, options = {}) {
  const display = options.badge ? getBadgeClass(value) : null;
  const formatted = formatValue(value);
  const isEmpty = formatted == null || formatted === "";

  return `
        <div class="credential-row">
            <span class="credential-label">${label}</span>
            <span class="credential-value ${isEmpty ? "empty" : ""}">
                ${display ? `<span class="badge ${display}">${formatted || "N/A"}</span>` : formatted || "—"}
            </span>
        </div>
    `;
}

// Configuration for fields
const FIELD_ORDER = [
  "firstName",
  "middleName",
  "lastName",
  "suffix",
  "name",
  "displayName",
  "email",
  "type",
  "applicantType",
  "status",
  "createdAt",
  "phone",
  "address",
];
const EXCLUDED_KEYS = new Set([
  "uid",
  "id",
  "isVerified",
  "darkMode",
  "zipcode",
  "zipCode",
  "isProfileComplete",
  "city",
]);

function getLabel(key) {
  const labels = {
    firstName: "First name",
    middleName: "Middle name",
    lastName: "Last name",
    suffix: "Suffix",
    name: "Full name",
    displayName: "Display name",
    email: "Email",
    type: "Type of applicant",
    applicantType: "Applicant type",
    status: "Status",
    createdAt: "Joined date",
    phone: "Phone",
    address: "Address",
  };
  return (
    labels[key] ||
    key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim()
  );
}

function renderPanel(user) {
  const name = user.name || user.displayName || "Unknown";
  const initial = name.charAt(0).toUpperCase();

  // Sort keys based on configuration
  const orderedKeys = FIELD_ORDER.filter(
    (k) => user[k] !== undefined && !EXCLUDED_KEYS.has(k),
  );
  const restKeys = Object.keys(user).filter(
    (k) => !EXCLUDED_KEYS.has(k) && !FIELD_ORDER.includes(k),
  );
  const allKeys = [...orderedKeys, ...restKeys];

  let rows = "";
  for (const key of allKeys) {
    rows += renderRow(getLabel(key), user[key], {
      badge: key === "type" || key === "applicantType" || key === "status",
    });
  }

  const html = `
        <div class="panel-header">
            <div class="panel-avatar">${initial}</div>
            <div class="panel-header-text">
                <h1>${name}</h1>
                <span class="sub">${user.email || "No email"}</span>
            </div>
        </div>
        <div class="panel-body">${rows}</div>
    `;

  const panel = document.getElementById("panel");
  if (panel) panel.innerHTML = html;
}
