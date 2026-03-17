import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "/js/config/firebase.js"; // Importing from your shared file

let allUsers = [];

// 1. Check Auth State BEFORE loading data
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.documentElement.classList.remove("auth-pending");
    loadUsers(); // Safe to load data now
  } else {
    console.log("User not logged in. Redirecting...");
    // Adjust this path if your login page is somewhere else
    window.location.href = "/pages/login/login.html";
  }
});

async function loadUsers() {
  const tableContainer = document.querySelector(".table-container");
  const usersTable = document.getElementById("usersTable");
  const errorContainer = document.getElementById("errorContainer");

  // SAFETY: Force the loader to hide after 5 seconds if Firestore is stuck
  const safetyTimer = setTimeout(() => {
    if (tableContainer && !tableContainer.classList.contains("table-loaded")) {
      tableContainer.classList.add("table-loaded");
      errorContainer.innerHTML =
        '<div class="error-msg">Connection timed out. Check your internet or console for errors.</div>';
    }
  }, 5000);

  try {
    // Show skeleton loading
    if (tableContainer) tableContainer.classList.remove("table-loaded");
    errorContainer.innerHTML = "";

    const usersCollection = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollection);

    // Clear safety timer because data loaded successfully
    clearTimeout(safetyTimer);

    allUsers = [];
    usersSnapshot.forEach((doc) => {
      allUsers.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    displayUsers(allUsers);
    // Hide skeleton and show real data
    if (tableContainer) tableContainer.classList.add("table-loaded");
  } catch (error) {
    clearTimeout(safetyTimer);
    console.error("Full Error Details:", error);
    if (tableContainer) tableContainer.classList.add("table-loaded");

    if (error.code === "permission-denied") {
      errorContainer.innerHTML = `<div class="error-msg">Permission Denied: Ensure your account has the 'admin' role in Firestore.</div>`;
    } else {
      errorContainer.innerHTML = `<div class="error-msg">Error: ${error.message}</div>`;
    }
  }
}

function getTypeBadgeClass(typeString) {
  if (!typeString) return "badge-gray";

  const lowerType = typeString.toLowerCase();

  if (
    lowerType.includes("active") ||
    lowerType.includes("walk-in") ||
    lowerType.includes("hired")
  )
    return "badge-green";
  if (lowerType.includes("pending") || lowerType.includes("online"))
    return "badge-blue";
  if (lowerType.includes("banned") || lowerType.includes("rejected"))
    return "badge-red";
  if (lowerType.includes("suspended")) return "badge-orange";

  return "badge-gray";
}

function displayUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  // Remove skeleton rows
  tbody.querySelectorAll(".table-skeleton-row").forEach((row) => row.remove());

  document.getElementById("filteredCount").textContent = users.length;
  document.getElementById("totalCount").textContent = allUsers.length;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 30px;">No users found</td></tr>`;
    return;
  }

  users.forEach((user) => {
    const row = document.createElement("tr");

    let joinedDate = "N/A";
    if (user.createdAt) {
      try {
        const date = user.createdAt.toDate
          ? user.createdAt.toDate()
          : new Date(user.createdAt);
        joinedDate = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch (e) {
        joinedDate = "Invalid Date";
      }
    }

    const name = user.name || user.displayName || "Unknown User";
    const initial = name.charAt(0).toUpperCase();
    const typeRaw = user.type || user.applicantType || user.status || "General";
    const badgeClass = getTypeBadgeClass(typeRaw);

    row.innerHTML = `
            <td><input type="checkbox"></td>
            <td>
                <div class="user-info">
                    <div class="avatar">${initial}</div>
                    <span class="user-name">${name}</span>
                </div>
            </td>
            <td class="user-email">${user.email || "N/A"}</td>
            <td><span class="badge ${badgeClass}">${typeRaw}</span></td>
            <td>${joinedDate}</td>
            <td style="text-align: center;">
                <div class="actions-cell-inner">
                    <div class="actions-dropdown">
                        <button type="button" class="btn btn-sm btn-actions-dropdown-toggle js-actions-dropdown-toggle" data-user-id="${user.id}" title="Actions" aria-label="Actions">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="actions-dropdown-menu">
                            <button type="button" class="actions-dropdown-item js-dropdown-view-user" data-user-id="${user.id}"><i class="fas fa-eye"></i> View</button>
                            <button type="button" class="actions-dropdown-item js-dropdown-edit-user" data-user-id="${user.id}"><i class="fas fa-pen"></i> Edit</button>
                            <button type="button" class="actions-dropdown-item actions-dropdown-item-danger js-dropdown-delete-user" data-user-id="${user.id}"><i class="fas fa-trash"></i> Delete</button>
                        </div>
                    </div>
                </div>
            </td>
        `;

    tbody.appendChild(row);
  });
}

// Event Listeners
const searchBox = document.getElementById("searchBox");
if (searchBox) {
  searchBox.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allUsers.filter((user) => {
      const text =
        `${user.name} ${user.email} ${user.type || ""}`.toLowerCase();
      return text.includes(term);
    });
    displayUsers(filtered);
  });
}

const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", loadUsers);
}

// Modal Logic
const viewModal = document.getElementById("viewModal");
const viewPanelFrame = document.getElementById("viewPanelFrame");
const viewModalClose = document.getElementById("viewModalClose");
const usersTableBody = document.getElementById("usersTableBody");

function closeActionsDropdowns() {
  document
    .querySelectorAll(".actions-dropdown-menu.open")
    .forEach((m) => m.classList.remove("open"));
}

if (usersTableBody) {
  usersTableBody.addEventListener("click", (e) => {
    const dropdownToggle = e.target?.closest?.(".js-actions-dropdown-toggle");
    if (dropdownToggle) {
      e.preventDefault();
      e.stopPropagation();
      const menu = dropdownToggle.nextElementSibling;
      if (menu?.classList?.contains("actions-dropdown-menu")) {
        const isOpen = menu.classList.contains("open");
        closeActionsDropdowns();
        if (!isOpen) {
          menu.classList.add("open");
          requestAnimationFrame(() => {
            const rect = dropdownToggle.getBoundingClientRect();
            const menuWidth = menu.offsetWidth || 140;
            const menuHeight = menu.offsetHeight || 160;
            const gap = 4;
            const viewportPadding = 8;
            let left = rect.right - menuWidth;
            if (left < viewportPadding) left = viewportPadding;
            if (left + menuWidth > window.innerWidth - viewportPadding)
              left = window.innerWidth - menuWidth - viewportPadding;
            let top;
            const spaceBelow = window.innerHeight - rect.bottom - gap;
            const spaceAbove = rect.top - gap;
            if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
              top = rect.bottom + gap;
            } else {
              top = rect.top - menuHeight - gap;
            }
            if (top < viewportPadding) top = viewportPadding;
            if (top + menuHeight > window.innerHeight - viewportPadding)
              top = window.innerHeight - menuHeight - viewportPadding;
            menu.style.top = `${top}px`;
            menu.style.left = `${left}px`;
          });
        }
      }
      return;
    }

    const viewBtn = e.target?.closest?.(".js-dropdown-view-user");
    if (viewBtn) {
      closeActionsDropdowns();
      const userId = viewBtn.getAttribute("data-user-id");
      if (!userId) return;
      viewPanelFrame.src =
        "user-credentials-panel.html?id=" + encodeURIComponent(userId);
      viewModal.classList.add("open");
      viewModal.setAttribute("aria-hidden", "false");
      return;
    }

    const editBtn = e.target?.closest?.(".js-dropdown-edit-user");
    if (editBtn) {
      closeActionsDropdowns();
      const userId = editBtn.getAttribute("data-user-id");
      if (userId) {
        // Edit user - placeholder for future implementation
      }
      return;
    }

    const deleteBtn = e.target?.closest?.(".js-dropdown-delete-user");
    if (deleteBtn) {
      closeActionsDropdowns();
      const userId = deleteBtn.getAttribute("data-user-id");
      if (userId) {
        // Delete user - placeholder for future implementation
      }
    }
  });
}

document.addEventListener("click", closeActionsDropdowns);

function closeViewModal() {
  if (viewModal) {
    viewModal.classList.remove("open");
    viewModal.setAttribute("aria-hidden", "true");
    viewPanelFrame.src = "about:blank";
  }
}

if (viewModalClose) viewModalClose.addEventListener("click", closeViewModal);
if (viewModal) {
  viewModal.addEventListener("click", (e) => {
    if (e.target === viewModal) closeViewModal();
  });
}
