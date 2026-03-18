import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db } from "/js/config/firebase.js";

let allStaff = [];

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.documentElement.classList.remove("auth-pending");
    loadStaff();
  } else {
    window.location.href = "/pages/login/login.html";
  }
});

async function loadStaff() {
  const tableContainer = document.querySelector(
    ".staff-table-container, .table-container",
  );
  const errorContainer = document.getElementById("errorContainer");

  const safetyTimer = setTimeout(() => {
    if (tableContainer && !tableContainer.classList.contains("table-loaded")) {
      tableContainer.classList.add("table-loaded");
      if (errorContainer)
        errorContainer.innerHTML =
          '<div class="error-msg">Connection timed out.</div>';
    }
  }, 5000);

  try {
    if (tableContainer) tableContainer.classList.remove("table-loaded");
    if (errorContainer) errorContainer.innerHTML = "";

    const q = query(collection(db, "adminUsers"), where("role", "==", "staff"));
    const snapshot = await getDocs(q);

    clearTimeout(safetyTimer);

    allStaff = [];
    snapshot.forEach((docSnap) => {
      allStaff.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

    displayStaff(allStaff);
    if (tableContainer) tableContainer.classList.add("table-loaded");
  } catch (error) {
    clearTimeout(safetyTimer);
    console.error("Load staff error:", error);
    if (tableContainer) tableContainer.classList.add("table-loaded");
    if (errorContainer)
      errorContainer.innerHTML = `<div class="error-msg">Error: ${error.message}</div>`;
  }
}

function formatDate(data) {
  try {
    const ts = data.createdAt;
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function displayStaff(staff) {
  const tbody = document.getElementById("staffTableBody");
  if (!tbody) return;

  tbody.querySelectorAll(".table-skeleton-row").forEach((r) => r.remove());

  const filteredCount = document.getElementById("filteredCount");
  const totalCount = document.getElementById("totalCount");
  if (filteredCount) filteredCount.textContent = staff.length;
  if (totalCount) totalCount.textContent = allStaff.length;

  if (staff.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 30px;">No staff accounts found</td></tr>`;
    return;
  }

  staff.forEach((s) => {
    const row = document.createElement("tr");
    const name = s.name || "—";
    const initial = name.charAt(0).toUpperCase();
    const isApproved = s.isApproved === true;
    const isDeclined = s.status === "declined";
    const statusBadge = isApproved
      ? '<span class="badge badge-green">Approved</span>'
      : isDeclined
        ? '<span class="badge badge-red">Declined</span>'
        : '<span class="badge badge-blue">Pending</span>';

    row.innerHTML = `
      <td>
        <div class="user-info">
          <div class="avatar">${initial}</div>
          <span class="user-name">${name}</span>
        </div>
      </td>
      <td class="user-email">${s.email || "—"}</td>
      <td>${formatDate(s)}</td>
      <td>${statusBadge}</td>
      <td style="text-align: center;">
        ${
          !isApproved && !isDeclined
            ? `
          <div class="actions-cell-inner">
            <div class="actions-dropdown">
              <button
                type="button"
                class="btn btn-sm btn-actions-dropdown-toggle js-staff-actions-dropdown-toggle"
                data-uid="${s.id}"
                title="Actions"
                aria-label="Actions"
              >
                <i class="fas fa-ellipsis-v"></i>
              </button>
              <div class="actions-dropdown-menu">
                <button
                  type="button"
                  class="actions-dropdown-item js-staff-accept"
                  data-uid="${s.id}"
                >
                  <i class="fas fa-check"></i> Accept
                </button>
                <button
                  type="button"
                  class="actions-dropdown-item actions-dropdown-item-danger js-staff-decline"
                  data-uid="${s.id}"
                >
                  <i class="fas fa-times"></i> Decline
                </button>
              </div>
            </div>
          </div>
        `
            : "—"
        }
      </td>
    `;
    tbody.appendChild(row);
  });

  // Close any open dropdowns
  function closeStaffDropdowns() {
    document
      .querySelectorAll(".actions-dropdown-menu.open")
      .forEach((m) => m.classList.remove("open"));
  }

  // Wire up actions dropdown toggle (same positioning pattern as other tables)
  tbody.addEventListener("click", (e) => {
    const toggle = e.target?.closest?.(".js-staff-actions-dropdown-toggle");
    if (toggle) {
      e.preventDefault();
      e.stopPropagation();
      const menu = toggle
        .closest(".actions-dropdown")
        ?.querySelector(".actions-dropdown-menu");
      if (!menu) return;
      const isOpen = menu.classList.contains("open");
      closeStaffDropdowns();
      if (!isOpen) {
        menu.classList.add("open");
        requestAnimationFrame(() => {
          const rect = toggle.getBoundingClientRect();
          const menuWidth = menu.offsetWidth || 160;
          const menuHeight = menu.offsetHeight || 120;
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
      return;
    }
  });

  document.addEventListener(
    "click",
    (e) => {
      if (!e.target.closest(".actions-dropdown")) {
        closeStaffDropdowns();
      }
    },
    { once: true },
  );

  // Accept staff
  tbody.querySelectorAll(".js-staff-accept").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const uid = btn.getAttribute("data-uid");
      if (!uid) return;
      btn.disabled = true;
      try {
        await updateDoc(doc(db, "adminUsers", uid), {
          isApproved: true,
          status: "approved",
        });
        loadStaff();
      } catch (err) {
        console.error(err);
        alert("Failed to accept: " + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Decline staff
  tbody.querySelectorAll(".js-staff-decline").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const uid = btn.getAttribute("data-uid");
      if (!uid) return;
      const confirmDecline = window.confirm(
        "Are you sure you want to decline this staff account?",
      );
      if (!confirmDecline) return;
      btn.disabled = true;
      try {
        await updateDoc(doc(db, "adminUsers", uid), {
          isApproved: false,
          status: "declined",
        });
        loadStaff();
      } catch (err) {
        console.error(err);
        alert("Failed to decline: " + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

const searchBox = document.getElementById("searchBox");
if (searchBox) {
  searchBox.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allStaff.filter((s) =>
      `${s.name || ""} ${s.email || ""}`.toLowerCase().includes(term),
    );
    displayStaff(filtered);
  });
}

const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) refreshBtn.addEventListener("click", loadStaff);
