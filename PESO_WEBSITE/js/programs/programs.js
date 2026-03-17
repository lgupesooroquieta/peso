import { db } from "/js/config/firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  collectionGroup,
  doc,
  deleteDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";
import { notifyProgramAdded } from "/js/onesignal/notifications.js";

// DOM Elements
const programsTableBody = document.getElementById("programsTableBody");
const loadingContainer = document.getElementById("loadingContainer");
const totalCountSpan = document.getElementById("totalCount");
const filteredCountSpan = document.getElementById("filteredCount");
const searchBox = document.getElementById("searchBox");
const errorContainer = document.getElementById("errorContainer");
const programsTable = document.getElementById("programsTable");
const programTypeFilter = document.getElementById("programTypeFilter");
const programTypeDropdown = document.getElementById("programTypeDropdown");
const programTypeSelectedLabel = document.getElementById(
  "programTypeSelectedLabel",
);
const programsStatusFilter = document.getElementById("programsStatusFilter");
const programsFilterDateRange = document.getElementById(
  "programsFilterDateRange",
);
const programsCustomDateInputs = document.getElementById(
  "programsCustomDateInputs",
);
const programsDateFrom = document.getElementById("programsDateFrom");
const programsDateTo = document.getElementById("programsDateTo");
const programsDateDropdown = document.getElementById("programsDateDropdown");
const programsCurrentDateFilter = document.getElementById(
  "programsCurrentDateFilter",
);
const viewProgramModal = document.getElementById("viewProgramModal");
const viewProgramModalClose = document.getElementById("viewProgramModalClose");
const viewProgramContent = document.getElementById("viewProgramContent");

// Form & Modal Add/Edit Elements
const addJobModal = document.getElementById("addJobModal");
const addJobModalTitle = document.getElementById("addJobModalTitle");
const addJobSubmitBtn = document.getElementById("addJobSubmitBtn");
const addJobForm = document.getElementById("addJobForm");
const openAddJobModalBtn = document.getElementById("openAddJobModalBtn");
const addJobCancelBtn = document.getElementById("addJobCancelBtn");
const addJobClearBtn = document.getElementById("addJobClearBtn");
const addJobModalClose = document.getElementById("addJobModalClose");

// Image Upload Elements
const bannerUploadArea = document.getElementById("bannerUploadArea");
const bannerPreview = document.getElementById("bannerPreview");
const modalProgramImage = document.getElementById("modalProgramImage");
const bannerRemoveImgBtn = document.getElementById("bannerRemoveImgBtn");

// Delete confirmation modal
const deleteModal = document.getElementById("deleteConfirmModal");
const deleteModalClose = document.getElementById("deleteModalClose");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
const deleteConfirmText = document.getElementById("deleteConfirmText");

// Save changes confirmation modal
const saveChangesModal = document.getElementById("saveChangesModal");
const saveChangesConfirmBtn = document.querySelector(
  ".js-confirm-save-changes",
);
const saveChangesMessage = document.getElementById("saveChangesMessage");
let pendingProgramSubmit = null;
let pendingProgramMode = "edit"; // "add" | "edit"

// Save changes modal handlers
if (saveChangesModal) {
  const closeBtn = saveChangesModal.querySelector(
    ".js-close-save-changes-modal",
  );
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      saveChangesModal.classList.remove("open");
      saveChangesModal.setAttribute("aria-hidden", "true");
    });
  }
  saveChangesModal.addEventListener("click", (e) => {
    if (e.target === saveChangesModal) {
      saveChangesModal.classList.remove("open");
      saveChangesModal.setAttribute("aria-hidden", "true");
    }
  });
}

if (saveChangesConfirmBtn) {
  saveChangesConfirmBtn.addEventListener("click", async () => {
    if (!pendingProgramSubmit) return;
    const btn = saveChangesConfirmBtn;
    const icon = btn?.querySelector("i");
    const text = btn?.querySelector(".btn-text");
    btn.disabled = true;
    if (icon) icon.className = "fas fa-spinner fa-spin";
    if (text)
      text.textContent =
        pendingProgramMode === "add" ? "Publishing..." : "Saving...";

    try {
      await pendingProgramSubmit();
      if (saveChangesModal) {
        saveChangesModal.classList.remove("open");
        saveChangesModal.setAttribute("aria-hidden", "true");
      }
    } finally {
      btn.disabled = false;
      if (icon) icon.className = "fas fa-save";
      if (text)
        text.textContent =
          pendingProgramMode === "add" ? "Publish Program" : "Save Changes";
      pendingProgramSubmit = null;
      pendingProgramMode = "edit";
    }
  });
}
// Global variable to store fetched data
let allProgramsData = [];
const PAGE_SIZE = 10;
let currentPage = 1;
let filteredPrograms = [];
let deleteTargetId = null;

// Check authentication before loading data
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.documentElement.classList.remove("auth-pending");
    fetchPrograms();
  } else {
    console.log("User not logged in. Redirecting...");
    window.location.href = "/pages/login/login.html";
  }
});

window.fetchPrograms = fetchPrograms;

// ---- FORM RESET AND MODAL LOGIC ---- //

function resetProgramForm() {
  if (addJobForm) addJobForm.reset();
  document.getElementById("editProgramId").value = "";
  document.getElementById("customProgramTypeContainer").style.display = "none";

  // Revert title to "Add Program" with default theme colors
  if (addJobModalTitle)
    addJobModalTitle.innerHTML =
      '<i class="fas fa-briefcase" style="margin-right: 8px;"></i> Add Program';
  if (addJobSubmitBtn)
    addJobSubmitBtn.innerHTML =
      '<i class="far fa-paper-plane"></i> Publish Program';

  // Clear Image Upload Area
  if (bannerUploadArea) bannerUploadArea.classList.remove("has-image");
  if (bannerPreview) bannerPreview.src = "";
  if (modalProgramImage) modalProgramImage.value = "";
}

if (openAddJobModalBtn) {
  openAddJobModalBtn.addEventListener("click", () => {
    resetProgramForm();
    if (addJobModal) {
      addJobModal.classList.add("open");
      addJobModal.setAttribute("aria-hidden", "false");
    }
  });
}

window.openEditProgramModal = function (program) {
  resetProgramForm();

  if (addJobModalTitle)
    addJobModalTitle.innerHTML =
      '<i class="fas fa-edit" style="margin-right: 8px;"></i> Edit Program';
  if (addJobSubmitBtn)
    addJobSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';

  document.getElementById("editProgramId").value = program.id || "";

  const typeSelect = document.getElementById("modalProgramType");
  const typeOptions = Array.from(typeSelect.options).map((o) => o.value);

  if (typeOptions.includes(program.programType)) {
    typeSelect.value = program.programType;
  } else {
    typeSelect.value = "Other";
    document.getElementById("customProgramTypeContainer").style.display =
      "block";
    document.getElementById("modalCustomProgramType").value =
      program.programType;
  }

  document.getElementById("modalDescription").value = program.description || "";
  document.getElementById("modalContactInfo").value = program.contactInfo || "";
  document.getElementById("modalDeadline").value = program.deadline || "";
  document.getElementById("modalContactPerson").value =
    program.contactPerson || "";

  if (program.imageUrl) {
    bannerPreview.src = program.imageUrl;
    bannerUploadArea.classList.add("has-image");
  }

  if (addJobModal) {
    addJobModal.classList.add("open");
    addJobModal.setAttribute("aria-hidden", "false");
  }
};

function closeAddJobModal() {
  if (addJobModal) {
    addJobModal.classList.remove("open");
    addJobModal.setAttribute("aria-hidden", "true");
  }
}

if (addJobCancelBtn)
  addJobCancelBtn.addEventListener("click", closeAddJobModal);
if (addJobModalClose)
  addJobModalClose.addEventListener("click", closeAddJobModal);

if (addJobClearBtn) {
  addJobClearBtn.addEventListener("click", () => {
    const isEdit = document.getElementById("editProgramId").value !== "";
    resetProgramForm();
    if (isEdit) {
      addJobModalTitle.innerHTML =
        '<i class="fas fa-edit" style="margin-right: 8px;"></i> Edit Program';
      addJobSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
  });
}

// ---- IMAGE UPLOAD LOGIC ---- //
if (modalProgramImage) {
  modalProgramImage.addEventListener("change", function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        bannerPreview.src = e.target.result;
        bannerUploadArea.classList.add("has-image");
      };
      reader.readAsDataURL(file);
    }
  });
}

if (bannerRemoveImgBtn) {
  bannerRemoveImgBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    modalProgramImage.value = "";
    bannerPreview.src = "";
    bannerUploadArea.classList.remove("has-image");
  });
}

document
  .getElementById("modalProgramType")
  ?.addEventListener("change", function () {
    const customContainer = document.getElementById(
      "customProgramTypeContainer",
    );
    if (this.value === "Other") {
      customContainer.style.display = "block";
    } else {
      customContainer.style.display = "none";
      document.getElementById("modalCustomProgramType").value = "";
    }
  });

// ---- PROGRAM SUBMIT LOGIC ---- //
async function performProgramSubmit() {
  if (!addJobSubmitBtn) return;

  const originalBtnHtml = addJobSubmitBtn.innerHTML;
  addJobSubmitBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Saving...';
  addJobSubmitBtn.disabled = true;

  try {
    const programId = document.getElementById("editProgramId").value;
    const typeSelect = document.getElementById("modalProgramType").value;
    const customType = document.getElementById("modalCustomProgramType").value;
    const finalType = typeSelect === "Other" ? customType : typeSelect;

    let finalImageUrl = null;
    if (
      bannerPreview.src &&
      !bannerPreview.src.includes(window.location.href)
    ) {
      finalImageUrl = bannerPreview.src;
    }

    const programData = {
      programType: finalType,
      description: document.getElementById("modalDescription").value,
      contactInfo: document.getElementById("modalContactInfo").value,
      deadline: document.getElementById("modalDeadline").value,
      contactPerson: document.getElementById("modalContactPerson").value,
      jobProgramImage: finalImageUrl,
      status: "active",
    };

    if (programId) {
      await updateDoc(doc(db, "jobPrograms", programId), programData);
      if (typeof window.showToast === "function") {
        window.showToast("Program updated successfully!", "success");
      }
    } else {
      programData.createdAt = serverTimestamp();
      const ref = await addDoc(collection(db, "jobPrograms"), programData);
      if (typeof window.showToast === "function") {
        window.showToast("Program published successfully!", "success");
      }
      notifyProgramAdded({
        type: "job",
        name: programData.programType,
        id: ref.id,
      }).catch(() => {});
    }

    closeAddJobModal();
    fetchPrograms(true);
  } catch (error) {
    console.error("Error saving program:", error);
    if (typeof window.showToast === "function") {
      window.showToast("Error saving program. Try again.", "error");
    }
  } finally {
    addJobSubmitBtn.innerHTML = originalBtnHtml;
    addJobSubmitBtn.disabled = false;
  }
}

if (addJobForm) {
  addJobForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const programId = document.getElementById("editProgramId").value;
    const isEdit = !!programId;

    if (saveChangesModal && saveChangesConfirmBtn) {
      pendingProgramSubmit = performProgramSubmit;
      pendingProgramMode = isEdit ? "edit" : "add";

      if (saveChangesMessage) {
        saveChangesMessage.textContent = isEdit
          ? "Are you sure you want to save changes to this program?"
          : "Are you sure you want to publish this new program?";
      }

      const icon = saveChangesConfirmBtn.querySelector("i");
      const text = saveChangesConfirmBtn.querySelector(".btn-text");
      if (icon) icon.className = "fas fa-save";
      if (text) text.textContent = isEdit ? "Save Changes" : "Publish Program";

      saveChangesModal.classList.add("open");
      saveChangesModal.setAttribute("aria-hidden", "false");
    } else {
      await performProgramSubmit();
    }
  });
}

// ---- DATA FETCHING & RENDERING ---- //
function getStatusFromDeadline(deadlineValue, existingStatus = "active") {
  const normalizedStatus = (existingStatus || "").toString().toLowerCase();

  if (normalizedStatus === "active" || normalizedStatus === "closed") {
    return {
      key: normalizedStatus,
      label: normalizedStatus === "active" ? "Active" : "Closed",
      badgeClass: normalizedStatus === "active" ? "badge-green" : "badge-red",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!deadlineValue) {
    return {
      key: existingStatus || "active",
      label:
        (existingStatus || "active").charAt(0).toUpperCase() +
        (existingStatus || "active").slice(1).toLowerCase(),
      badgeClass:
        (existingStatus || "active").toLowerCase() === "closed"
          ? "badge-red"
          : "badge-green",
    };
  }

  let deadlineDate;
  try {
    if (deadlineValue.toDate) {
      deadlineDate = deadlineValue.toDate();
    } else {
      deadlineDate = new Date(deadlineValue);
    }
  } catch {
    deadlineDate = null;
  }

  if (!deadlineDate || Number.isNaN(deadlineDate.getTime())) {
    return {
      key: existingStatus || "active",
      label:
        (existingStatus || "active").charAt(0).toUpperCase() +
        (existingStatus || "active").slice(1).toLowerCase(),
      badgeClass:
        (existingStatus || "active").toLowerCase() === "closed"
          ? "badge-red"
          : "badge-green",
    };
  }

  deadlineDate.setHours(0, 0, 0, 0);

  if (deadlineDate < today) {
    return {
      key: "closed",
      label: "Closed",
      badgeClass: "badge-red",
    };
  }

  return {
    key: "active",
    label: "Active",
    badgeClass: "badge-green",
  };
}

async function fetchPrograms(skipLoadingOverlay = false) {
  try {
    if (!db) throw new Error("Database not found.");

    if (!skipLoadingOverlay && loadingContainer)
      LoadingOverlay.show(loadingContainer);
    if (programsTable) programsTable.style.display = "none";
    if (errorContainer) errorContainer.innerHTML = "";

    const programsQuery = query(
      collection(db, "jobPrograms"),
      orderBy("createdAt", "desc"),
    );
    const programsSnapshot = await getDocs(programsQuery);

    const applicantsQuery = query(collectionGroup(db, "JobApplied"));
    const applicantsSnapshot = await getDocs(applicantsQuery);

    const applicantsCountMap = {};
    applicantsSnapshot.forEach((doc) => {
      const data = doc.data();
      const programName = data.jobProgramName;
      if (programName) {
        applicantsCountMap[programName] =
          (applicantsCountMap[programName] || 0) + 1;
      }
    });

    allProgramsData = [];
    programsSnapshot.forEach((snapshotDoc) => {
      const data = snapshotDoc.data();

      let formattedDate = "N/A";
      let createdAtDate = null;
      if (data.createdAt && data.createdAt.toDate) {
        createdAtDate = data.createdAt.toDate();
        formattedDate = createdAtDate.toLocaleDateString();
      }

      const statusInfo = getStatusFromDeadline(
        data.deadline || null,
        data.status || "active",
      );

      const applicantCount = applicantsCountMap[data.programType] || 0;

      allProgramsData.push({
        id: snapshotDoc.id,
        programType: data.programType || "N/A",
        description: data.description || "No description",
        deadline: data.deadline || "No deadline",
        contactInfo: data.contactInfo || "N/A",
        contactPerson: data.contactPerson || null,
        status: statusInfo.key,
        statusLabel: statusInfo.label,
        statusBadgeClass: statusInfo.badgeClass,
        imageUrl: data.jobProgramImage || null,
        createdAt: formattedDate,
        createdAtDate,
        applicantCount: applicantCount,
      });
    });

    populateProgramTypeFilterOptions();
    applyFilters();
  } catch (error) {
    console.error("Error fetching programs:", error);
    if (errorContainer) {
      errorContainer.innerHTML = `<div class="error-msg">Error loading programs: ${error.message}</div>`;
    }
    if (programsTableBody) {
      programsTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading data.</td></tr>`;
    }
  } finally {
    if (!skipLoadingOverlay && loadingContainer)
      LoadingOverlay.hide(loadingContainer);
    if (programsTable) programsTable.style.display = "table";
  }
}

const KNOWN_TYPE_SLUGS = ["spes", "gip", "tupad", "jobstart", "other"];

function populateProgramTypeFilterOptions() {
  const optionsContainer = document.querySelector(
    "#programTypeDropdown .dropdown-options",
  );
  if (!optionsContainer || !programTypeFilter) return;

  const currentValue = programTypeFilter.value;
  const coreTypes = ["SPES", "GIP", "TUPAD", "JobStart"];
  const typeSet = new Set([...coreTypes, "Other"]);

  allProgramsData.forEach((p) => {
    const t = (p.programType || "").trim();
    if (t && t !== "N/A") typeSet.add(t);
  });

  const customTypes = [...typeSet]
    .filter((t) => t !== "Other" && !coreTypes.includes(t))
    .sort();
  const sortedTypes = [...coreTypes, ...customTypes, "Other"];

  const allTypesActive = !currentValue ? " active" : "";
  let html = `<li data-value="" class="${allTypesActive}">All types</li>`;
  sortedTypes.forEach((t) => {
    const active = t === currentValue ? " active" : "";
    html += `<li data-value="${escapeHtml(t)}"${active}>${escapeHtml(t)}</li>`;
  });

  optionsContainer.innerHTML = html;

  const selectedLabel =
    currentValue && sortedTypes.includes(currentValue)
      ? currentValue
      : "All types";
  if (programTypeSelectedLabel)
    programTypeSelectedLabel.textContent = selectedLabel;
}

function applyFilters() {
  if (!programsTableBody) return;

  const searchTerm = searchBox ? searchBox.value.toLowerCase().trim() : "";
  const typeFilter = programTypeFilter ? programTypeFilter.value.trim() : "";
  const statusFilter = programsStatusFilter
    ? programsStatusFilter.value || "all"
    : "all";
  const dateFilter = programsFilterDateRange
    ? programsFilterDateRange.value
    : "all";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let startDate = null;
  let endDate = null;

  if (dateFilter === "week") {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay());
  } else if (dateFilter === "month") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (dateFilter === "year") {
    startDate = new Date(today.getFullYear(), 0, 1);
  } else if (dateFilter === "custom" && programsDateFrom && programsDateTo) {
    if (programsDateFrom.value) startDate = new Date(programsDateFrom.value);
    if (programsDateTo.value) {
      endDate = new Date(programsDateTo.value);
      endDate.setHours(23, 59, 59, 999);
    }
  }

  let filtered = allProgramsData.filter((program) => {
    const matchesSearch =
      !searchTerm ||
      program.programType.toLowerCase().includes(searchTerm) ||
      program.description.toLowerCase().includes(searchTerm) ||
      program.contactInfo.toLowerCase().includes(searchTerm);

    const matchesType = !typeFilter || program.programType === typeFilter;
    const matchesStatus =
      statusFilter === "all" || program.status === statusFilter;

    let matchesDate = true;
    if (program.createdAtDate && dateFilter !== "all") {
      if (startDate && program.createdAtDate < startDate) matchesDate = false;
      if (endDate && program.createdAtDate > endDate) matchesDate = false;
    }

    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });

  filteredPrograms = filtered;
  currentPage = 1;
  renderProgramsTable();
}

function renderProgramsTable() {
  if (!programsTableBody) return;

  const totalFiltered = filteredPrograms.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredPrograms.slice(start, start + PAGE_SIZE);

  if (filteredCountSpan) filteredCountSpan.textContent = totalFiltered;
  if (totalCountSpan) totalCountSpan.textContent = allProgramsData.length;

  const paginationLabel = document.getElementById("programsPaginationLabel");
  const paginationPrev = document.getElementById("programsPaginationPrev");
  const paginationNext = document.getElementById("programsPaginationNext");
  if (paginationLabel)
    paginationLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  if (paginationPrev)
    paginationPrev.setAttribute("aria-disabled", String(currentPage <= 1));
  if (paginationNext)
    paginationNext.setAttribute(
      "aria-disabled",
      String(currentPage >= totalPages),
    );

  if (totalFiltered === 0) {
    programsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="padding: 40px; color: #6b7280;">
          No programs found matching your filters.
        </td>
      </tr>
    `;
    return;
  }

  programsTableBody.innerHTML = pageData
    .map((program) => {
      const typeSlug = (program.programType || "")
        .toLowerCase()
        .replace(/\s+/g, "-");
      const safeTypeSlug = KNOWN_TYPE_SLUGS.includes(typeSlug)
        ? typeSlug
        : "other";
      return `
        <tr class="js-program-row" data-program-id="${escapeHtml(program.id)}" role="button" tabindex="0" title="Click to view">
          <td style="text-align: start">
            <div class="program-info" style="justify-content: flex-start;">
              ${
                program.imageUrl
                  ? `<img src="${program.imageUrl}" alt="${program.programType}" class="program-image" />`
                  : `<div class="program-image-placeholder"><i class="fas fa-clipboard-list"></i></div>`
              }
              <div>
                <div class="program-name">${escapeHtml(program.programType)}</div>
                <div class="program-type">Created: ${program.createdAt}</div>
              </div>
            </div>
          </td>
          <td style="text-align: center">
            <span class="tag-pill tag-${safeTypeSlug}">${escapeHtml(
              program.programType,
            )}</span>
          </td>
          <td style="text-align: center">
            <div class="program-deadline">${escapeHtml(program.deadline)}</div>
          </td>
          <td style="text-align: center">
            <button
              type="button"
              class="applicants-count-button js-applicants-button"
              data-program-type="${escapeHtml(program.programType)}"
            >
              <span class="applicants-count">
                <i class="fas fa-users"></i>
                ${program.applicantCount}
              </span>
            </button>
          </td>
          <td style="text-align: center">
            <button
              type="button"
              class="status-toggle-button js-status-toggle"
              data-program-id="${program.id}"
              data-status="${program.status}"
            >
              <span class="badge ${program.statusBadgeClass}">
                ${escapeHtml(program.statusLabel)}
              </span>
            </button>
          </td>
          <td class="program-actions-cell" style="text-align: center; white-space: nowrap">
            <div class="actions-cell-inner">
              <div class="actions-dropdown">
                <button
                  type="button"
                  class="btn btn-sm btn-actions-dropdown-toggle js-actions-dropdown-toggle"
                  data-program-id="${program.id}"
                  title="Actions"
                  aria-label="Actions"
                >
                  <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="actions-dropdown-menu">
                  <button type="button" class="actions-dropdown-item js-dropdown-view-program" data-program-id="${program.id}">
                    <i class="fas fa-eye"></i> View
                  </button>
                  <button type="button" class="actions-dropdown-item js-dropdown-edit-program" data-program-id="${program.id}">
                    <i class="fas fa-edit"></i> Edit
                  </button>
                  <button type="button" class="actions-dropdown-item actions-dropdown-item-danger js-dropdown-delete-program" data-program-id="${program.id}">
                    <i class="fas fa-trash-alt"></i> Delete
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Search and filter event listeners
if (searchBox) searchBox.addEventListener("input", applyFilters);

// Dropdown helpers
function closeActionsDropdowns() {
  document
    .querySelectorAll(".actions-dropdown-menu.open")
    .forEach((m) => m.classList.remove("open"));
}

function closeAllDropdowns() {
  closeActionsDropdowns();
  programTypeDropdown?.classList.remove("open");
  programsDateDropdown?.classList.remove("open");
  programTypeDropdown
    ?.closest(".date-filter-group")
    ?.classList.remove("active");
  programsDateDropdown
    ?.closest(".date-filter-group")
    ?.classList.remove("active");
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
  containerEl.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li) {
      e.stopPropagation();
      onPick(li);
    }
  });
}

// Program type dropdown
setupDropdown(programTypeDropdown);
setupOptionsClick(
  document.querySelector("#programTypeDropdown .dropdown-options"),
  (li) => {
    const value = li.getAttribute("data-value") || "";
    if (programTypeSelectedLabel)
      programTypeSelectedLabel.textContent = li.textContent.trim();
    if (programTypeFilter) programTypeFilter.value = value;
    programTypeDropdown
      ?.querySelectorAll(".dropdown-options li")
      .forEach((el) => el.classList.remove("active"));
    li.classList.add("active");
    closeAllDropdowns();
    applyFilters();
  },
);

if (programsFilterDateRange) {
  programsFilterDateRange.addEventListener("change", () => {
    if (programsCustomDateInputs) {
      programsCustomDateInputs.classList.toggle(
        "hidden",
        programsFilterDateRange.value !== "custom",
      );
    }
    applyFilters();
  });
}
if (programsDateFrom) programsDateFrom.addEventListener("change", applyFilters);
if (programsDateTo) programsDateTo.addEventListener("change", applyFilters);

// Status Tabs
const statusTabsContainer = document.getElementById("statusTabs");
if (statusTabsContainer) {
  const tabs = statusTabsContainer.querySelectorAll(".applicant-filter-cell");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const val = tab.getAttribute("data-status");
      if (programsStatusFilter) {
        programsStatusFilter.value = val;
      }
      applyFilters();
    });
  });
}

// Date dropdown
setupDropdown(programsDateDropdown);
setupOptionsClick(
  document.querySelector("#programsDateDropdown .dropdown-options"),
  (li) => {
    const value = li.getAttribute("data-value") || "";
    if (programsCurrentDateFilter)
      programsCurrentDateFilter.textContent = li.textContent;
    if (programsFilterDateRange) programsFilterDateRange.value = value;
    programsDateDropdown
      ?.querySelectorAll(".dropdown-options li")
      .forEach((el) => el.classList.remove("active"));
    li.classList.add("active");
    if (programsCustomDateInputs) {
      programsCustomDateInputs.classList.toggle("hidden", value !== "custom");
    }
    closeAllDropdowns();
    applyFilters();
  },
);

document.addEventListener("click", closeAllDropdowns);

// Pagination
const programsPaginationPrev = document.getElementById(
  "programsPaginationPrev",
);
const programsPaginationNext = document.getElementById(
  "programsPaginationNext",
);
if (programsPaginationPrev) {
  programsPaginationPrev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderProgramsTable();
    }
  });
}
if (programsPaginationNext) {
  programsPaginationNext.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredPrograms.length / PAGE_SIZE),
    );
    if (currentPage < totalPages) {
      currentPage++;
      renderProgramsTable();
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function deleteProgram(programId) {
  if (!db || !programId) return;
  try {
    await deleteDoc(doc(db, "jobPrograms", programId));
    await fetchPrograms(true);
    if (typeof window.showToast === "function") {
      window.showToast("Program deleted.", "success");
    }
  } catch (err) {
    console.error("Error deleting program:", err);
    if (typeof window.showToast === "function") {
      window.showToast(
        "Failed to delete program. " + (err.message || ""),
        "error",
      );
    } else {
      alert("Failed to delete program. " + (err.message || ""));
    }
  }
}

async function toggleProgramStatus(programId, currentStatus) {
  if (!db || !programId) return;

  const nextStatus =
    (currentStatus || "").toLowerCase() === "active" ? "closed" : "active";
  const label = nextStatus === "active" ? "Active" : "Closed";

  if (
    !confirm(
      `Are you sure you want to mark this program as ${label}? You can change it back later.`,
    )
  )
    return;

  try {
    await updateDoc(doc(db, "jobPrograms", programId), {
      status: nextStatus,
    });
    await fetchPrograms(true);
  } catch (err) {
    console.error("Error updating program status:", err);
    alert("Failed to update status. " + (err.message || ""));
  }
}

programsTableBody?.addEventListener("click", (e) => {
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

  const statusBtn = e.target?.closest?.(".js-status-toggle");
  if (statusBtn) {
    const programId = statusBtn.getAttribute("data-program-id");
    const currentStatus = statusBtn.getAttribute("data-status") || "active";
    if (programId) toggleProgramStatus(programId, currentStatus);
    return;
  }

  const applicantsBtn = e.target?.closest?.(".js-applicants-button");
  if (applicantsBtn) {
    const programType = applicantsBtn.getAttribute("data-program-type") || "";
    const url = `/pages/job_applicants/job_applicants.html${
      programType ? `?programType=${encodeURIComponent(programType)}` : ""
    }`;
    window.location.href = url;
    return;
  }

  const viewBtn = e.target?.closest?.(".js-dropdown-view-program");
  if (viewBtn) {
    closeActionsDropdowns();
    const programId = viewBtn.getAttribute("data-program-id");
    const program = allProgramsData.find((p) => p.id === programId);
    if (program) openViewProgramModal(program);
    return;
  }

  const editBtn = e.target?.closest?.(".js-dropdown-edit-program");
  if (editBtn) {
    closeActionsDropdowns();
    const programId = editBtn.getAttribute("data-program-id");
    const program = allProgramsData.find((p) => p.id === programId);
    if (program && typeof window.openEditProgramModal === "function") {
      window.openEditProgramModal(program);
    }
    return;
  }

  const row = e.target?.closest?.(".js-program-row");
  if (row) {
    const excluded = e.target?.closest?.(
      ".js-actions-dropdown-toggle, .actions-dropdown-menu, .js-status-toggle, .js-applicants-button",
    );
    if (!excluded) {
      const programId = row.getAttribute("data-program-id");
      const program = allProgramsData.find((p) => p.id === programId);
      if (program) openViewProgramModal(program);
      return;
    }
  }

  const deleteBtn = e.target?.closest?.(".js-dropdown-delete-program");
  if (deleteBtn) {
    closeActionsDropdowns();
    const programId = deleteBtn.getAttribute("data-program-id");
    if (programId) {
      deleteTargetId = programId;
      const program = allProgramsData.find((p) => p.id === programId);
      const name = program?.programType || "this program";
      if (deleteConfirmText) {
        deleteConfirmText.textContent = `Are you sure you want to delete "${name}"? This cannot be undone.`;
      }
      if (deleteModal) {
        deleteModal.classList.add("open");
        deleteModal.setAttribute("aria-hidden", "false");
      }
    }
  }
});

function closeDeleteModal() {
  if (deleteModal) {
    deleteModal.classList.remove("open");
    deleteModal.setAttribute("aria-hidden", "true");
  }
  deleteTargetId = null;
}

if (deleteModalClose)
  deleteModalClose.addEventListener("click", closeDeleteModal);
if (deleteCancelBtn)
  deleteCancelBtn.addEventListener("click", closeDeleteModal);
if (deleteModal) {
  deleteModal.addEventListener("click", (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });
}

if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener("click", async () => {
    if (!deleteTargetId) return;
    deleteConfirmBtn.disabled = true;
    try {
      await deleteProgram(deleteTargetId);
      closeDeleteModal();
    } finally {
      deleteConfirmBtn.disabled = false;
    }
  });
}

// ---- VIEW PROGRAM MODAL (Program Details layout) ---- //
function openViewProgramModal(program) {
  if (!viewProgramContent || !viewProgramModal) return;

  const statusKey = (program.status || "").toString().toLowerCase();
  const statusLabel =
    program.statusLabel ||
    (statusKey ? statusKey.charAt(0).toUpperCase() + statusKey.slice(1) : "—");
  const isClosed = statusKey === "closed";

  const title = program.programType || "Program";
  const postedDate = program.createdAt || "—";
  const deadline = program.deadline || "—";
  const applicants = Number.isFinite(program.applicantCount)
    ? String(program.applicantCount)
    : "0";
  const contactInfo = program.contactInfo || "—";
  const contactPerson = program.contactPerson || "—";
  const deadlineLabel =
    deadline && deadline !== "No deadline" ? deadline : "Not specified";
  const typeLabel = program.programType || "Other";
  const hasImage = Boolean(program.imageUrl);

  viewProgramContent.innerHTML = `
    <div class="pvm-container">
      <div class="pvm-header">
        <div class="pvm-header-icon">
          <i class="fas fa-clipboard-list"></i>
        </div>
        <div class="pvm-header-text">
          <h2>Program Details</h2>
          <span class="pvm-header-status ${
            isClosed ? "is-closed" : ""
          }">${escapeHtml(statusLabel)}</span>
        </div>
      </div>

      <div class="pvm-body">
        <div class="pvm-left">
          <div class="pvm-image-card ${
            hasImage ? "has-image" : ""
          }" aria-label="Program image">
            ${
              hasImage
                ? `<img src="${escapeHtml(
                    program.imageUrl,
                  )}" alt="Program image" />`
                : `
              <div class="pvm-image-placeholder">
                <i class="far fa-image"></i>
                <span>No image</span>
              </div>`
            }
          </div>

          <div class="pvm-type-row">
            <button type="button" class="pvm-type-pill" disabled>
              <span class="pvm-type-dot"></span>
              ${escapeHtml(typeLabel)}
            </button>
            <span class="pvm-applicants-chip">
              <i class="fas fa-users"></i>
              ${escapeHtml(applicants)} applicants
            </span>
          </div>

          <div class="pvm-contact-card">
            <span class="pvm-card-label">Contact Person</span>
            <span class="pvm-card-value">${escapeHtml(contactPerson)}</span>
          </div>
        </div>

        <div class="pvm-right">
          <div class="pvm-section">
            <div class="pvm-field-label">Program Name</div>
            <div class="pvm-program-name">${escapeHtml(title)}</div>
          </div>

          <hr class="pvm-divider" />

          <div class="pvm-section">
            <div class="pvm-field-label">Program Description</div>
            <div class="pvm-description">
              ${escapeHtml(program.description || "—")}
            </div>
          </div>

          <div class="pvm-info-row">
            <div class="pvm-info-card">
              <div class="pvm-info-icon">
                <i class="far fa-envelope"></i>
              </div>
              <div class="pvm-info-text">
                <span class="pvm-card-label">Contact Info</span>
                <span class="pvm-card-value">${escapeHtml(contactInfo)}</span>
              </div>
            </div>

            <div class="pvm-info-card">
              <div class="pvm-info-icon calendar">
                <i class="far fa-calendar-alt"></i>
              </div>
              <div class="pvm-info-text">
                <span class="pvm-card-label">Application Deadline</span>
                <span class="pvm-card-value">${escapeHtml(deadlineLabel)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="pvm-footer">
        <button type="button" class="pvm-btn pvm-btn-danger js-pvm-delete">
          <i class="fas fa-trash"></i>
          Delete
        </button>
        <button type="button" class="pvm-btn pvm-btn-primary js-pvm-edit">
          <i class="fas fa-pencil-alt"></i>
          Edit Program
        </button>
      </div>
    </div>
  `;

  // Bind action buttons inside modal
  const editBtn = viewProgramContent.querySelector(".js-pvm-edit");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      closeViewProgramModal();
      if (typeof window.openEditProgramModal === "function") {
        window.openEditProgramModal(program);
      }
    });
  }

  const deleteBtn = viewProgramContent.querySelector(".js-pvm-delete");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      closeViewProgramModal();
      deleteTargetId = program.id || null;
      const name = title || "this program";
      if (deleteConfirmText) {
        deleteConfirmText.textContent = `Are you sure you want to delete "${name}"? This cannot be undone.`;
      }
      if (deleteModal) {
        deleteModal.classList.add("open");
        deleteModal.setAttribute("aria-hidden", "false");
      }
    });
  }

  viewProgramModal.classList.add("open");
  viewProgramModal.setAttribute("aria-hidden", "false");
}

function closeViewProgramModal() {
  if (viewProgramModal) {
    viewProgramModal.classList.remove("open");
    viewProgramModal.setAttribute("aria-hidden", "true");
  }
}

if (viewProgramModalClose)
  viewProgramModalClose.addEventListener("click", closeViewProgramModal);
if (viewProgramModal) {
  viewProgramModal.addEventListener("click", (e) => {
    if (e.target === viewProgramModal) closeViewProgramModal();
  });
}
