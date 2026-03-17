import { db } from "/js/config/firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";
import { notifyAnnouncementAdded } from "/js/onesignal/notifications.js";

const ANNOUNCEMENTS_COLLECTION = "announcements";
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dbjzniu96/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "mobile_upload";

const loadingContainer = document.getElementById("loadingContainer");
const announcementsCardsList = document.getElementById(
  "announcementsCardsList",
);
const announcementsCount = document.getElementById("announcementsCount");
const announcementsTotalCount = document.getElementById(
  "announcementsTotalCount",
);
const errorContainer = document.getElementById("errorContainer");
const deleteConfirmOverlay = document.getElementById("deleteConfirmOverlay");
const deleteConfirmMessage = document.getElementById("deleteConfirmMessage");
const deleteConfirmCancel = document.getElementById("deleteConfirmCancel");
const deleteConfirmOk = document.getElementById("deleteConfirmOk");

// Modal elements
const addAnnouncementModal = document.getElementById("addAnnouncementModal");
const openAddAnnouncementModalBtn = document.getElementById(
  "openAddAnnouncementModalBtn",
);
const addAnnouncementModalClose = document.getElementById(
  "addAnnouncementModalClose",
);
const addAnnouncementClearBtn = document.getElementById(
  "addAnnouncementClearBtn",
);
const addAnnouncementForm = document.getElementById("addAnnouncementForm");
const addAnnouncementFormMessage = document.getElementById(
  "addAnnouncementFormMessage",
);
const addAnnouncementSubmitBtn = document.getElementById(
  "addAnnouncementSubmitBtn",
);
const addAnnouncementModalTitle = document.getElementById(
  "addAnnouncementModalTitle",
);
const saveChangesModal = document.getElementById("saveChangesModal");
const saveChangesConfirmBtn = document.querySelector(
  ".js-confirm-save-changes",
);
let pendingAnnouncementSubmit = null;
const announcementIdInput = document.getElementById("announcementId");
const modalCategorySelect = document.getElementById("modalCategory");
const modalCustomCategoryContainer = document.getElementById(
  "modalCustomCategoryContainer",
);
const modalCustomCategoryInput = document.getElementById("modalCustomCategory");
const modalAnnouncementImageInput = document.getElementById(
  "modalAnnouncementImage",
);
const modalAnnouncementBannerPreview = document.getElementById(
  "modalAnnouncementBannerPreview",
);
const modalAnnouncementBannerPlaceholder = document.getElementById(
  "modalAnnouncementBannerPlaceholder",
);
const modalAnnouncementBannerUploadArea = document.getElementById(
  "modalAnnouncementBannerUploadArea",
);
const modalAnnouncementBannerRemoveBtn = document.getElementById(
  "modalAnnouncementBannerRemoveBtn",
);

let deleteTargetId = null;
let allAnnouncements = [];
const PAGE_SIZE = 10;
let currentPage = 1;
let filteredAnnouncements = [];

function escapeHtml(text) {
  if (text == null || text === "") return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatPostedLabel(postedAt) {
  if (!postedAt) return "—";
  const date = postedAt.toDate ? postedAt.toDate() : new Date(postedAt);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Posted just now";
  if (diffMins < 60)
    return `Posted ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `Posted ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "Posted 1 day ago";
  if (diffDays < 7) return `Posted ${diffDays} days ago`;
  return date.toLocaleDateString();
}

function setAnnouncementModalImagePreview(url) {
  if (url) {
    if (modalAnnouncementBannerPreview) {
      modalAnnouncementBannerPreview.src = url;
      modalAnnouncementBannerPreview.style.display = "block";
    }
    if (modalAnnouncementBannerPlaceholder)
      modalAnnouncementBannerPlaceholder.style.display = "none";
    if (modalAnnouncementBannerUploadArea)
      modalAnnouncementBannerUploadArea.classList.add("has-image");
    if (addAnnouncementForm) delete addAnnouncementForm.dataset.removeImage;
  } else {
    if (modalAnnouncementImageInput) modalAnnouncementImageInput.value = "";
    if (modalAnnouncementBannerPreview) {
      modalAnnouncementBannerPreview.src = "";
      modalAnnouncementBannerPreview.style.display = "none";
    }
    if (modalAnnouncementBannerPlaceholder)
      modalAnnouncementBannerPlaceholder.style.display = "block";
    if (modalAnnouncementBannerUploadArea)
      modalAnnouncementBannerUploadArea.classList.remove("has-image");
    if (addAnnouncementForm) addAnnouncementForm.dataset.removeImage = "true";
  }
}

function getCategoryClass(category) {
  if (!category) return "announcement-category--other";
  const c = (category + "").toLowerCase();
  if (c.includes("peso")) return "announcement-category--peso";
  if (c.includes("training")) return "announcement-category--training";
  if (c.includes("tips")) return "announcement-category--tips";
  return "announcement-category--other";
}

function parseDisplayDateToInput(dateStr) {
  if (!dateStr || !dateStr.trim()) return "";
  const d = new Date(dateStr.trim());
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function formatDateForStorage(isoDateStr) {
  if (!isoDateStr || !isoDateStr.trim()) return "";
  const d = new Date(isoDateStr.trim());
  if (isNaN(d.getTime())) return isoDateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getPostedAtDate(item) {
  if (!item.postedAt) return null;
  return item.postedAt.toDate
    ? item.postedAt.toDate()
    : new Date(item.postedAt);
}

function applyFilters() {
  const search = (
    document.getElementById("announcementsSearchBox")?.value || ""
  )
    .trim()
    .toLowerCase();
  const categoryFilter = (
    document.getElementById("announcementsCategoryFilter")?.value || ""
  ).trim();
  const dateRange =
    document.getElementById("announcementsFilterDateRange")?.value || "all";
  const dateFrom =
    document.getElementById("announcementsDateFrom")?.value || "";
  const dateTo = document.getElementById("announcementsDateTo")?.value || "";

  let filtered = allAnnouncements.slice();

  if (search) {
    filtered = filtered.filter(
      (a) =>
        (a.title || "").toLowerCase().includes(search) ||
        (a.description || "").toLowerCase().includes(search) ||
        (a.category || "").toLowerCase().includes(search),
    );
  }

  if (categoryFilter) {
    filtered = filtered.filter((a) => (a.category || "") === categoryFilter);
  }

  if (dateRange && dateRange !== "all") {
    const now = new Date();
    let startDate = null;
    if (dateRange === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (dateRange === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateRange === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (dateRange === "custom" && dateFrom) {
      startDate = new Date(dateFrom);
      startDate.setHours(0, 0, 0, 0);
    }
    let endDate =
      dateRange === "custom" && dateTo ? new Date(dateTo) : new Date(now);
    if (dateRange === "custom" && !dateTo) endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    const endTime = endDate.getTime();

    filtered = filtered.filter((a) => {
      const posted = getPostedAtDate(a);
      if (!posted) return false;
      const t = posted.getTime();
      return (!startDate || t >= startDate.getTime()) && t <= endTime;
    });
  }

  filteredAnnouncements = filtered;
  currentPage = 1;
  renderAnnouncements();
}

function truncateDesc(text, maxLen = 80) {
  if (!text || !text.trim()) return "";
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trim() + "…";
}

function renderAnnouncements() {
  const totalFiltered = filteredAnnouncements.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredAnnouncements.slice(start, start + PAGE_SIZE);

  if (announcementsCount) announcementsCount.textContent = totalFiltered;
  if (announcementsTotalCount)
    announcementsTotalCount.textContent = allAnnouncements.length;

  const paginationLabel = document.getElementById(
    "announcementsPaginationLabel",
  );
  const paginationPrev = document.getElementById("announcementsPaginationPrev");
  const paginationNext = document.getElementById("announcementsPaginationNext");
  if (paginationLabel)
    paginationLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  if (paginationPrev)
    paginationPrev.setAttribute("aria-disabled", String(currentPage <= 1));
  if (paginationNext)
    paginationNext.setAttribute(
      "aria-disabled",
      String(currentPage >= totalPages),
    );

  if (!announcementsCardsList) return;
  if (pageItems.length === 0) {
    announcementsCardsList.innerHTML = `
      <div class="announcements-cards-empty" role="status">
        ${allAnnouncements.length === 0 ? 'No announcements yet. Click "Add Announcement" to create one.' : "No announcements match the current filters."}
      </div>
    `;
  } else {
    announcementsCardsList.innerHTML = pageItems
      .map((a) => {
        const subtitle = truncateDesc(a.description);
        const dateDisplay =
          a.date || (a.postedAt ? formatPostedLabel(a.postedAt) : "—");
        const thumb = a.imageUrl
          ? `<img src="${escapeHtml(a.imageUrl)}" alt="" />`
          : `<span class="announcement-card-thumb-placeholder"><i class="fas fa-bullhorn"></i></span>`;
        return `
          <article class="announcement-card js-announcement-card" data-id="${escapeHtml(a.id)}" role="listitem">
            <div class="announcement-card-thumb">${thumb}</div>
            <div class="announcement-card-content">
              <h3 class="announcement-card-title">${escapeHtml(a.title)}</h3>
              <p class="announcement-card-subtitle">${escapeHtml(subtitle)}</p>
            </div>
            <div class="announcement-card-date">${escapeHtml(dateDisplay)}</div>
            <span class="announcement-card-status">Published</span>
            <div class="announcement-card-actions">
              <div class="actions-dropdown">
                <button type="button" class="js-actions-dropdown-toggle" data-id="${escapeHtml(a.id)}" title="Actions" aria-label="Actions">
                  <i class="fas fa-cog"></i>
                </button>
                <div class="actions-dropdown-menu">
                  <button type="button" class="actions-dropdown-item js-dropdown-view-announcement" data-id="${escapeHtml(a.id)}">
                    <i class="fas fa-eye"></i> View
                  </button>
                  <button type="button" class="actions-dropdown-item js-dropdown-edit-announcement" data-id="${escapeHtml(a.id)}">
                    <i class="fas fa-edit"></i> Edit
                  </button>
                  <button type="button" class="actions-dropdown-item actions-dropdown-item-danger js-dropdown-delete-announcement" data-id="${escapeHtml(a.id)}" data-title="${escapeHtml(a.title)}">
                    <i class="fas fa-trash"></i> Delete
                  </button>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }
}

function closeActionsDropdowns() {
  document
    .querySelectorAll(".actions-dropdown-menu.open")
    .forEach((m) => m.classList.remove("open"));
}

function closeAllDropdowns() {
  closeActionsDropdowns();
  const categoryDropdown = document.getElementById(
    "announcementsCategoryDropdown",
  );
  const dateDropdown = document.getElementById("announcementsDateDropdown");
  categoryDropdown?.classList.remove("open");
  dateDropdown?.classList.remove("open");
  categoryDropdown?.closest(".date-filter-group")?.classList.remove("active");
  dateDropdown?.closest(".date-filter-group")?.classList.remove("active");
}

function setupDropdown(dropdownEl) {
  if (!dropdownEl) return;
  const groupEl = dropdownEl.closest(".date-filter-group");
  dropdownEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !dropdownEl.classList.contains("open");
    closeAllDropdowns();
    dropdownEl.classList.toggle("open", willOpen);
    groupEl?.classList.toggle("active", willOpen);
  });
}

function setupOptionsClick(containerEl, onPick) {
  if (!containerEl) return;
  containerEl.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      onPick(li);
    });
  });
}

function setupCategoryDropdown() {
  const dropdown = document.getElementById("announcementsCategoryDropdown");
  const hidden = document.getElementById("announcementsCategoryFilter");
  const label = document.getElementById("announcementsCategorySelectedLabel");
  if (!dropdown || !hidden || !label) return;
  setupDropdown(dropdown);
  setupOptionsClick(dropdown.querySelector(".dropdown-options"), (li) => {
    const value = li.getAttribute("data-value") || "";
    hidden.value = value;
    label.textContent = value ? li.textContent.trim() : "All types";
    dropdown
      .querySelectorAll(".dropdown-options li")
      .forEach((el) => el.classList.remove("active"));
    li.classList.add("active");
    closeAllDropdowns();
    applyFilters();
  });
}

function setupDateDropdown() {
  const dropdown = document.getElementById("announcementsDateDropdown");
  const hidden = document.getElementById("announcementsFilterDateRange");
  const label = document.getElementById("announcementsCurrentDateFilter");
  const customContainer = document.getElementById(
    "announcementsCustomDateInputs",
  );
  const dateFrom = document.getElementById("announcementsDateFrom");
  const dateTo = document.getElementById("announcementsDateTo");
  if (!dropdown || !hidden || !label) return;

  const labels = {
    all: "All Time",
    week: "This Week",
    month: "This Month",
    year: "This Year",
    custom: "Custom Range",
  };

  setupDropdown(dropdown);
  setupOptionsClick(dropdown.querySelector(".dropdown-options"), (li) => {
    const value = li.getAttribute("data-value") || "all";
    hidden.value = value;
    label.textContent = labels[value] || value;
    dropdown
      .querySelectorAll(".dropdown-options li")
      .forEach((el) => el.classList.remove("active"));
    li.classList.add("active");
    if (customContainer)
      customContainer.classList.toggle("hidden", value !== "custom");
    closeAllDropdowns();
    applyFilters();
  });
  if (dateFrom) dateFrom.addEventListener("change", applyFilters);
  if (dateTo) dateTo.addEventListener("change", applyFilters);
}

function setupAnnouncementsDropdowns() {
  setupCategoryDropdown();
  setupDateDropdown();
  document.addEventListener("click", closeAllDropdowns);
}

// Event Delegation for Table/List
if (announcementsCardsList) {
  announcementsCardsList.addEventListener("click", (e) => {
    const card = e.target?.closest?.(".js-announcement-card");
    if (card && !e.target?.closest?.(".announcement-card-actions")) {
      const id = card.getAttribute("data-id");
      if (id) openViewAnnouncementModal(id);
      return;
    }

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

    const viewBtn = e.target?.closest?.(".js-dropdown-view-announcement");
    if (viewBtn) {
      closeActionsDropdowns();
      const id = viewBtn.getAttribute("data-id");
      if (id) openViewAnnouncementModal(id);
      return;
    }

    const editBtn = e.target?.closest?.(".js-dropdown-edit-announcement");
    if (editBtn) {
      closeActionsDropdowns();
      const id = editBtn.getAttribute("data-id");
      if (id) openEditAnnouncementModal(id);
      return;
    }

    const deleteBtn = e.target?.closest?.(".js-dropdown-delete-announcement");
    if (deleteBtn) {
      closeActionsDropdowns();
      const id = deleteBtn.getAttribute("data-id");
      const title = deleteBtn.getAttribute("data-title") || "this announcement";
      deleteTargetId = id;
      if (deleteConfirmMessage)
        deleteConfirmMessage.textContent = `Delete "${title}"? This cannot be undone.`;
      if (deleteConfirmOverlay) {
        deleteConfirmOverlay.style.display = "flex";
        deleteConfirmOverlay.setAttribute("aria-hidden", "false");
      }
    }
  });
}

// Pagination
const announcementsPaginationPrev = document.getElementById(
  "announcementsPaginationPrev",
);
const announcementsPaginationNext = document.getElementById(
  "announcementsPaginationNext",
);
if (announcementsPaginationPrev) {
  announcementsPaginationPrev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderAnnouncements();
    }
  });
}
if (announcementsPaginationNext) {
  announcementsPaginationNext.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredAnnouncements.length / PAGE_SIZE),
    );
    if (currentPage < totalPages) {
      currentPage++;
      renderAnnouncements();
    }
  });
}

// Add/Edit Announcement Modal
function openAddAnnouncementModal() {
  if (addAnnouncementModalTitle)
    addAnnouncementModalTitle.innerHTML =
      '<i class="fas fa-bullhorn"></i> Add Announcement';
  if (addAnnouncementSubmitBtn)
    addAnnouncementSubmitBtn.innerHTML =
      '<i class="fas fa-save"></i> Save Announcement';
  if (announcementIdInput) announcementIdInput.value = "";
  if (addAnnouncementForm) addAnnouncementForm.reset();
  if (modalCustomCategoryContainer)
    modalCustomCategoryContainer.style.display = "none";
  if (modalCustomCategoryInput) {
    modalCustomCategoryInput.removeAttribute("required");
    modalCustomCategoryInput.value = "";
  }
  if (addAnnouncementFormMessage) {
    addAnnouncementFormMessage.classList.add("hidden");
    addAnnouncementFormMessage.textContent = "";
  }
  if (addAnnouncementForm) {
    delete addAnnouncementForm.dataset.editImageUrl;
    delete addAnnouncementForm.dataset.removeImage;
  }
  setAnnouncementModalImagePreview("");
  if (addAnnouncementModal) {
    addAnnouncementModal.classList.add("open");
    addAnnouncementModal.setAttribute("aria-hidden", "false");
  }
}

async function openEditAnnouncementModal(id) {
  try {
    const ref = doc(db, ANNOUNCEMENTS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const d = snap.data();
    if (announcementIdInput) announcementIdInput.value = id;
    const titleEl = document.getElementById("modalTitle");
    const descEl = document.getElementById("modalDescription");
    const dateEl = document.getElementById("modalDisplayDate");
    const targetEl = document.getElementById("modalTargetIntent");
    if (titleEl) titleEl.value = d.title || "";
    if (descEl) descEl.value = d.description || "";
    if (dateEl) dateEl.value = parseDisplayDateToInput(d.date || "");
    if (targetEl) targetEl.value = d.targetIntent || "both";

    const category = (d.category || "").trim();
    if (modalCategorySelect) {
      const hasOption = [...modalCategorySelect.options].some(
        (o) => o.value === category,
      );
      if (hasOption) {
        modalCategorySelect.value = category;
        if (modalCustomCategoryContainer)
          modalCustomCategoryContainer.style.display = "none";
        if (modalCustomCategoryInput) {
          modalCustomCategoryInput.removeAttribute("required");
          modalCustomCategoryInput.value = "";
        }
      } else {
        modalCategorySelect.value = "Other";
        if (modalCustomCategoryContainer)
          modalCustomCategoryContainer.style.display = "block";
        if (modalCustomCategoryInput) {
          modalCustomCategoryInput.value = category;
          modalCustomCategoryInput.setAttribute("required", "true");
        }
      }
    }

    if (addAnnouncementModalTitle)
      addAnnouncementModalTitle.innerHTML =
        '<i class="fas fa-edit"></i> Edit Announcement';
    if (addAnnouncementSubmitBtn)
      addAnnouncementSubmitBtn.innerHTML =
        '<i class="fas fa-save"></i> Update Announcement';
    if (addAnnouncementForm)
      addAnnouncementForm.dataset.editImageUrl = d.imageUrl || "";
    setAnnouncementModalImagePreview(d.imageUrl || "");
    if (modalAnnouncementImageInput) modalAnnouncementImageInput.value = "";
    if (addAnnouncementForm) delete addAnnouncementForm.dataset.removeImage;
    if (addAnnouncementFormMessage) {
      addAnnouncementFormMessage.classList.add("hidden");
      addAnnouncementFormMessage.textContent = "";
    }
    if (addAnnouncementModal) {
      addAnnouncementModal.classList.add("open");
      addAnnouncementModal.setAttribute("aria-hidden", "false");
    }
  } catch (err) {
    console.error("Error loading announcement for edit:", err);
    if (errorContainer)
      errorContainer.innerHTML = `<div class="error-msg">Failed to load announcement.</div>`;
  }
}

function closeAddAnnouncementModal() {
  if (addAnnouncementModal) {
    addAnnouncementModal.classList.remove("open");
    addAnnouncementModal.setAttribute("aria-hidden", "true");
  }
}

// UPDATED: View Announcement Modal Landscape
async function openViewAnnouncementModal(id) {
  try {
    const ref = doc(db, ANNOUNCEMENTS_COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const d = snap.data();

    const targetBadgeText =
      d.targetIntent === "job"
        ? "JOB"
        : d.targetIntent === "scholarship"
          ? "SCHOLARSHIP"
          : "BOTH";

    let headerDateStr = "—";
    const dateSource = d.date || (d.postedAt ? d.postedAt.toDate() : null);

    if (dateSource) {
      const dateObj = new Date(dateSource);
      if (!isNaN(dateObj.getTime())) {
        headerDateStr = dateObj.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
    }

    const content = document.getElementById("viewAnnouncementContent");

    if (content) {
      content.innerHTML = `
        <div class="avm-container">
          <div class="avm-header">
            <div class="avm-header-icon">
              <i class="fas fa-bullhorn"></i>
            </div>
            <div class="avm-header-text">
              <h2>Announcement Details</h2>
              <span class="avm-header-status">PUBLISHED</span>
            </div>
          </div>

          <div class="avm-body">
            <div class="avm-left-panel">
              <div class="avm-icon-wrapper">
                ${
                  d.imageUrl
                    ? `<img src="${escapeHtml(d.imageUrl)}" alt="Image">`
                    : `<i class="fas fa-university"></i>`
                }
              </div>
              
              <div class="avm-image-badges">
                <div class="avm-badge">
                  <i class="fas fa-bullseye"></i> Target: ${escapeHtml(targetBadgeText)}
                </div>
              </div>

              <div class="avm-stats-list">
                <div class="avm-stat-item">
                  <div class="avm-stat-icon"><i class="far fa-calendar-alt"></i></div>
                  <div class="avm-stat-text">
                    <span class="avm-stat-label">DATE POSTED</span>
                    <span class="avm-stat-val" title="${escapeHtml(headerDateStr)}">${escapeHtml(headerDateStr)}</span>
                  </div>
                </div>
                
                <div class="avm-stat-item">
                  <div class="avm-stat-icon"><i class="far fa-folder"></i></div>
                  <div class="avm-stat-text">
                    <span class="avm-stat-label">CATEGORY</span>
                    <span class="avm-stat-val" title="${escapeHtml(d.category || "—")}">${escapeHtml(d.category || "—")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="avm-right-panel">
              <div class="avm-section">
                <div class="avm-field-label">ANNOUNCEMENT NAME</div>
                <div class="avm-program-name">${escapeHtml(d.title || "Untitled")}</div>
              </div>
              
              <hr class="avm-divider" />
              
              <div class="avm-section">
                <div class="avm-field-label">DESCRIPTION</div>
                <div class="avm-desc-content">${escapeHtml(d.description || "—").replace(/\n/g, "<br>")}</div>
              </div>
            </div>
          </div>

          <div class="avm-footer">
            <button type="button" class="avm-btn avm-btn-delete js-avm-delete">
              <i class="fas fa-trash"></i> Delete
            </button>
            <button type="button" class="avm-btn avm-btn-edit js-avm-edit">
              <i class="fas fa-pencil-alt"></i> Edit Announcement
            </button>
          </div>
        </div>
      `;
    }

    const viewModal = document.getElementById("viewAnnouncementModal");
    if (viewModal) {
      viewModal.classList.add("open");
      viewModal.setAttribute("aria-hidden", "false");
    }

    // Bind action buttons inside modal
    const editBtn = document.querySelector(".js-avm-edit");
    if (editBtn)
      editBtn.addEventListener("click", () => {
        closeViewAnnouncementModal();
        openEditAnnouncementModal(id);
      });

    const deleteBtn = document.querySelector(".js-avm-delete");
    if (deleteBtn)
      deleteBtn.addEventListener("click", () => {
        closeViewAnnouncementModal();
        deleteTargetId = id;
        if (deleteConfirmMessage)
          deleteConfirmMessage.textContent = `Delete "${d.title || "this announcement"}"? This cannot be undone.`;
        if (deleteConfirmOverlay) {
          deleteConfirmOverlay.style.display = "flex";
          deleteConfirmOverlay.setAttribute("aria-hidden", "false");
        }
      });
  } catch (err) {
    console.error("Error loading announcement for view:", err);
    if (errorContainer)
      errorContainer.innerHTML = `<div class="error-msg">Failed to load announcement.</div>`;
  }
}

function closeViewAnnouncementModal() {
  const viewModal = document.getElementById("viewAnnouncementModal");
  if (viewModal) {
    viewModal.classList.remove("open");
    viewModal.setAttribute("aria-hidden", "true");
  }
}

function showAnnouncementFormMessage(text, type) {
  if (!addAnnouncementFormMessage) return;
  addAnnouncementFormMessage.textContent = text;
  addAnnouncementFormMessage.className = "announcement-form-message " + type;
  addAnnouncementFormMessage.classList.remove("hidden");
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.documentElement.classList.remove("auth-pending");
    loadAnnouncements();
    setupCategoryDropdown();
    setupDateDropdown();
    if (document.getElementById("announcementsSearchBox")) {
      document
        .getElementById("announcementsSearchBox")
        .addEventListener("input", () => applyFilters());
    }
  } else {
    window.location.href = "/pages/login/login.html";
  }
});

async function loadAnnouncements(skipLoadingOverlay = false) {
  try {
    if (!skipLoadingOverlay && loadingContainer)
      LoadingOverlay.show(loadingContainer);
    if (announcementsCardsList) announcementsCardsList.innerHTML = "";
    if (errorContainer) errorContainer.innerHTML = "";

    const q = query(
      collection(db, ANNOUNCEMENTS_COLLECTION),
      orderBy("postedAt", "desc"),
    );
    const snapshot = await getDocs(q);
    allAnnouncements = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      allAnnouncements.push({
        id: docSnap.id,
        title: d.title || "",
        description: d.description || "",
        date: d.date || "",
        postedLabel:
          d.postedLabel != null ? d.postedLabel : formatPostedLabel(d.postedAt),
        category: d.category || "",
        targetIntent: d.targetIntent || "both",
        postedAt: d.postedAt,
        imageUrl: d.imageUrl || "",
      });
    });

    applyFilters();
  } catch (err) {
    console.error("Error loading announcements:", err);
    if (errorContainer) {
      errorContainer.innerHTML = `<div class="error-msg">Error loading announcements: ${err.message}</div>`;
    }
    if (announcementsCardsList) {
      announcementsCardsList.innerHTML = `<div class="announcements-cards-empty text-danger">Error loading data.</div>`;
    }
  } finally {
    if (!skipLoadingOverlay && loadingContainer)
      LoadingOverlay.hide(loadingContainer);
    applyFilters();
  }
}

// Modal: category Other -> show custom input
if (modalCategorySelect) {
  modalCategorySelect.addEventListener("change", () => {
    if (modalCategorySelect.value === "Other") {
      if (modalCustomCategoryContainer)
        modalCustomCategoryContainer.style.display = "block";
      if (modalCustomCategoryInput)
        modalCustomCategoryInput.setAttribute("required", "true");
    } else {
      if (modalCustomCategoryContainer)
        modalCustomCategoryContainer.style.display = "none";
      if (modalCustomCategoryInput) {
        modalCustomCategoryInput.removeAttribute("required");
        modalCustomCategoryInput.value = "";
      }
    }
  });
}

if (openAddAnnouncementModalBtn)
  openAddAnnouncementModalBtn.addEventListener(
    "click",
    openAddAnnouncementModal,
  );
if (addAnnouncementModalClose)
  addAnnouncementModalClose.addEventListener(
    "click",
    closeAddAnnouncementModal,
  );
if (addAnnouncementModal) {
  addAnnouncementModal.addEventListener("click", (e) => {
    if (e.target === addAnnouncementModal) closeAddAnnouncementModal();
  });
}

const viewAnnouncementModalClose = document.getElementById(
  "viewAnnouncementModalClose",
);
const viewAnnouncementModal = document.getElementById("viewAnnouncementModal");
if (viewAnnouncementModalClose) {
  viewAnnouncementModalClose.addEventListener(
    "click",
    closeViewAnnouncementModal,
  );
}
if (viewAnnouncementModal) {
  viewAnnouncementModal.addEventListener("click", (e) => {
    if (e.target === viewAnnouncementModal) closeViewAnnouncementModal();
  });
}

if (addAnnouncementClearBtn) {
  addAnnouncementClearBtn.addEventListener("click", () => {
    if (addAnnouncementForm) addAnnouncementForm.reset();
    if (addAnnouncementForm) {
      delete addAnnouncementForm.dataset.editImageUrl;
      delete addAnnouncementForm.dataset.removeImage;
    }
    setAnnouncementModalImagePreview("");
    if (announcementIdInput) announcementIdInput.value = "";
    if (modalCustomCategoryContainer)
      modalCustomCategoryContainer.style.display = "none";
    if (modalCustomCategoryInput) {
      modalCustomCategoryInput.removeAttribute("required");
      modalCustomCategoryInput.value = "";
    }
    openAddAnnouncementModal();
  });
}

if (modalAnnouncementImageInput) {
  modalAnnouncementImageInput.addEventListener("change", function (e) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (ev) {
        setAnnouncementModalImagePreview(ev.target?.result || "");
      };
      reader.readAsDataURL(file);
    }
  });
}
if (modalAnnouncementBannerRemoveBtn) {
  modalAnnouncementBannerRemoveBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setAnnouncementModalImagePreview("");
  });
}

async function performAnnouncementSubmit() {
  if (addAnnouncementFormMessage)
    addAnnouncementFormMessage.classList.add("hidden");

  const title = document.getElementById("modalTitle")?.value?.trim();
  const description = document
    .getElementById("modalDescription")
    ?.value?.trim();
  const displayDateRaw = document
    .getElementById("modalDisplayDate")
    ?.value?.trim();
  let category = document.getElementById("modalCategory")?.value?.trim() || "";
  const targetIntent =
    document.getElementById("modalTargetIntent")?.value || "both";
  const id = announcementIdInput?.value?.trim();

  if (!title || !description) {
    showAnnouncementFormMessage(
      "Please fill in title and description.",
      "error",
    );
    return;
  }

  const date = formatDateForStorage(displayDateRaw);
  if (!date) {
    showAnnouncementFormMessage("Please select a valid display date.", "error");
    return;
  }

  if (category === "Other") {
    const custom = modalCustomCategoryInput?.value?.trim();
    if (!custom) {
      showAnnouncementFormMessage(
        "Please enter a category name for Other.",
        "error",
      );
      return;
    }
    category = custom;
  }

  if (addAnnouncementSubmitBtn) {
    addAnnouncementSubmitBtn.disabled = true;
    addAnnouncementSubmitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }

  try {
    const imageFile = modalAnnouncementImageInput?.files?.[0] || null;
    const existingImageUrl =
      id && addAnnouncementForm?.dataset?.editImageUrl
        ? addAnnouncementForm.dataset.editImageUrl
        : "";
    const removeImage = addAnnouncementForm?.dataset?.removeImage === "true";

    let imageUrl = "";
    if (removeImage) {
      imageUrl = "";
    } else if (imageFile) {
      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const response = await fetch(CLOUDINARY_URL, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Image upload failed.");
      const uploadData = await response.json();
      imageUrl = uploadData.secure_url;
    } else if (id && existingImageUrl) {
      imageUrl = existingImageUrl;
    }

    const now = Timestamp.now();
    const postedLabel = formatPostedLabel(now);
    const data = {
      title,
      description,
      date,
      postedLabel,
      category,
      targetIntent,
      imageUrl: imageUrl || null,
      postedAt: now,
    };

    if (id) {
      await updateDoc(doc(db, ANNOUNCEMENTS_COLLECTION, id), data);
      if (typeof window.showToast === "function")
        window.showToast("Saved changes", "success");
      notifyAnnouncementAdded({
        title: data.title || "",
        id,
        isNew: false,
      }).catch(() => {});
    } else {
      const ref = await addDoc(collection(db, ANNOUNCEMENTS_COLLECTION), data);
      if (typeof window.showToast === "function")
        window.showToast("Announcement created successfully.", "success");
      notifyAnnouncementAdded({
        title: data.title || "",
        id: ref.id,
        isNew: true,
      }).catch(() => {});
    }

    setTimeout(() => {
      closeAddAnnouncementModal();
      loadAnnouncements(true);
    }, 1200);
  } catch (err) {
    console.error("Save failed:", err);
    showAnnouncementFormMessage(
      "Save failed: " + (err.message || "Unknown error"),
      "error",
    );
  } finally {
    if (addAnnouncementSubmitBtn) {
      addAnnouncementSubmitBtn.disabled = false;
      addAnnouncementSubmitBtn.innerHTML = id
        ? '<i class="fas fa-save"></i> Update Announcement'
        : '<i class="fas fa-save"></i> Save Announcement';
    }
  }
}

if (saveChangesModal) {
  const closeBtn = saveChangesModal.querySelector(
    ".js-close-save-changes-modal",
  );
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      saveChangesModal.classList.remove("open");
    });
  }
  saveChangesModal.addEventListener("click", (e) => {
    if (e.target === saveChangesModal)
      saveChangesModal.classList.remove("open");
  });
}

if (saveChangesConfirmBtn) {
  saveChangesConfirmBtn.addEventListener("click", async () => {
    if (!pendingAnnouncementSubmit) return;
    const btn = saveChangesConfirmBtn;
    const icon = btn?.querySelector("i");
    const text = btn?.querySelector(".btn-text");
    btn.disabled = true;
    if (icon) icon.className = "fas fa-spinner fa-spin";
    if (text) text.textContent = "Saving...";

    try {
      await pendingAnnouncementSubmit();
      if (saveChangesModal) saveChangesModal.classList.remove("open");
    } finally {
      btn.disabled = false;
      if (icon) icon.className = "fas fa-save";
      if (text) text.textContent = "Save Changes";
      pendingAnnouncementSubmit = null;
    }
  });
}

if (addAnnouncementForm) {
  addAnnouncementForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = announcementIdInput?.value?.trim();
    if (id) {
      if (saveChangesModal) {
        pendingAnnouncementSubmit = performAnnouncementSubmit;
        saveChangesModal.classList.add("open");
      } else {
        await performAnnouncementSubmit();
      }
    } else {
      await performAnnouncementSubmit();
    }
  });
}

if (deleteConfirmCancel) {
  deleteConfirmCancel.addEventListener("click", () => {
    deleteTargetId = null;
    if (deleteConfirmOverlay) {
      deleteConfirmOverlay.style.display = "none";
      deleteConfirmOverlay.setAttribute("aria-hidden", "true");
    }
  });
}

if (deleteConfirmOk) {
  deleteConfirmOk.addEventListener("click", async () => {
    if (!deleteTargetId) return;
    try {
      await deleteDoc(doc(db, ANNOUNCEMENTS_COLLECTION, deleteTargetId));
      deleteTargetId = null;
      if (deleteConfirmOverlay) {
        deleteConfirmOverlay.style.display = "none";
        deleteConfirmOverlay.setAttribute("aria-hidden", "true");
      }
      if (typeof window.showToast === "function")
        window.showToast("Announcement deleted successfully.", "success");
      loadAnnouncements(true);
    } catch (err) {
      console.error("Delete failed:", err);
      if (errorContainer) {
        errorContainer.innerHTML = `<div class="error-msg">Delete failed: ${err.message}</div>`;
      }
    }
  });
}

if (deleteConfirmOverlay) {
  deleteConfirmOverlay.addEventListener("click", (e) => {
    if (e.target === deleteConfirmOverlay) {
      deleteTargetId = null;
      deleteConfirmOverlay.style.display = "none";
      deleteConfirmOverlay.setAttribute("aria-hidden", "true");
    }
  });
}