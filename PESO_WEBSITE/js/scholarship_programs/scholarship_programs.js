import { db } from "/js/config/firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";
import { notifyProgramAdded } from "/js/onesignal/notifications.js";

const COLLECTION_NAME = "scholarshipPrograms";
const VALID_TYPES = ["OFOP", "CITY SCHOLAR", "custom"];
const PAGE_SIZE = 10;
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dbjzniu96/image/upload";
const CLOUDINARY_UPLOAD_PRESET = "mobile_upload";

// DOM
const loadingContainer = document.getElementById("loadingContainer");
const errorContainer = document.getElementById("errorContainer");
const successContainer = document.getElementById("successContainer");
const searchBox = document.getElementById("searchBox");
const typeFilter = document.getElementById("typeFilter");
const typeFilterDropdown = document.getElementById("typeFilterDropdown");
const typeFilterSelectedLabel = document.getElementById(
  "typeFilterSelectedLabel",
);
const table = document.getElementById("scholarshipProgramsTable");
const tableBody = document.getElementById("scholarshipProgramsTableBody");
const tableFooter = document.getElementById("tableFooter");
const emptyState = document.getElementById("emptyState");
const filteredCountSpan = document.getElementById("filteredCount");
const totalCountSpan = document.getElementById("totalCount");
const paginationLabel = document.getElementById("paginationLabel");
const paginationPrev = document.getElementById("paginationPrev");
const paginationNext = document.getElementById("paginationNext");

const modal = document.getElementById("scholarshipProgramModal");
const modalTitle = document.getElementById("modalTitle");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalClearBtn = document.getElementById("modalClearBtn");
const scholarshipCancelBtn = document.getElementById("scholarshipCancelBtn");
const form = document.getElementById("scholarshipProgramForm");
const formMessage = document.getElementById("formMessage");
const editProgramIdInput = document.getElementById("editProgramId");
const formSubmitBtn = document.getElementById("formSubmitBtn");

const deleteModal = document.getElementById("deleteConfirmModal");
const deleteModalClose = document.getElementById("deleteModalClose");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");
const deleteConfirmBtn = document.getElementById("deleteConfirmBtn");
const deleteConfirmText = document.getElementById("deleteConfirmText");
const viewScholarshipModal = document.getElementById("viewScholarshipModal");
const viewScholarshipModalClose = document.getElementById(
  "viewScholarshipModalClose",
);
const viewScholarshipContent = document.getElementById(
  "viewScholarshipContent",
);
const saveChangesModal = document.getElementById("saveChangesModal");
const saveChangesConfirmBtn = document.querySelector(
  ".js-confirm-save-changes",
);

let allPrograms = [];
let filteredPrograms = [];
let currentPage = 1;
let deleteTargetId = null;
let pendingScholarshipSubmit = null;

// --- Helpers ---
function escapeHtml(text) {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function showError(msg) {
  if (errorContainer) {
    errorContainer.innerHTML = `<div class="error-msg">${escapeHtml(msg)}</div>`;
  }
  if (successContainer) {
    successContainer.classList.add("hidden");
    successContainer.innerHTML = "";
  }
}

function showSuccess(msg) {
  if (successContainer) {
    successContainer.textContent = msg;
    successContainer.classList.remove("hidden");
  }
  if (errorContainer) errorContainer.innerHTML = "";
  setTimeout(() => {
    if (successContainer) {
      successContainer.classList.add("hidden");
    }
  }, 4000);
}

function clearError() {
  if (errorContainer) errorContainer.innerHTML = "";
}

/** Parse qualifications/requirements: newline or comma separated -> array of trimmed strings */
function parseListInput(value) {
  if (!value || typeof value !== "string") return [];
  return value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Format date input (yyyy-mm-dd) to "March 15, 2026" */
function formatDeadlineDisplay(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Get value from form field */
function getFormValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

// --- Auth & Fetch ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.documentElement.classList.remove("auth-pending");
    fetchPrograms();
  } else {
    window.location.href = "/pages/login/login.html";
  }
});

async function fetchPrograms(skipLoadingOverlay = false) {
  try {
    if (!skipLoadingOverlay && loadingContainer)
      LoadingOverlay.show(loadingContainer);
    if (table) table.style.display = "none";
    if (emptyState) emptyState.classList.add("hidden");
    if (tableFooter) tableFooter.style.display = "none";
    clearError();

    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("createdAt", "desc"),
    );
    const snapshot = await getDocs(q);

    allPrograms = [];
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      let createdAtFormatted = "N/A";
      let createdAtDate = null;
      if (d.createdAt && d.createdAt.toDate) {
        createdAtDate = d.createdAt.toDate();
        createdAtFormatted = createdAtDate.toLocaleDateString();
      }
      allPrograms.push({
        id: docSnap.id,
        name: d.name || "",
        type: d.type || "",
        description: d.description || "",
        deadline: d.deadline || "",
        slots: d.slots != null ? String(d.slots) : "",
        qualifications: d.qualifications,
        requirements: d.requirements,
        imageUrl: d.imageUrl || null,
        createdAt: createdAtFormatted,
        createdAtDate,
      });
    });

    applyFilters();
  } catch (err) {
    console.error("Error fetching scholarship programs:", err);
    showError("Failed to load programs: " + err.message);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading data.</td></tr>`;
    }
  } finally {
    if (!skipLoadingOverlay && loadingContainer)
      LoadingOverlay.hide(loadingContainer);
    renderTableOrEmpty();
  }
}

function applyFilters() {
  const search = searchBox ? searchBox.value.toLowerCase().trim() : "";
  const typeVal = typeFilter ? typeFilter.value.trim() : "";

  filteredPrograms = allPrograms.filter((p) => {
    const matchSearch =
      !search ||
      (p.name && p.name.toLowerCase().includes(search)) ||
      (p.description && p.description.toLowerCase().includes(search)) ||
      (p.type && p.type.toLowerCase().includes(search));
    const matchType = !typeVal || p.type === typeVal;
    return matchSearch && matchType;
  });

  currentPage = 1;
  renderTable();
}

function renderTable() {
  if (!tableBody) return;

  const total = filteredPrograms.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredPrograms.slice(start, start + PAGE_SIZE);

  if (filteredCountSpan) filteredCountSpan.textContent = total;
  if (totalCountSpan) totalCountSpan.textContent = allPrograms.length;

  if (paginationLabel)
    paginationLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  if (paginationPrev)
    paginationPrev.setAttribute("aria-disabled", String(currentPage <= 1));
  if (paginationNext)
    paginationNext.setAttribute(
      "aria-disabled",
      String(currentPage >= totalPages),
    );

  if (total === 0) {
    tableBody.innerHTML = "";
    renderTableOrEmpty();
    return;
  }

  tableBody.innerHTML = pageData
    .map(
      (p) => `
    <tr class="js-scholarship-row" data-id="${escapeHtml(p.id)}" role="button" tabindex="0" title="Click to view">
      <td style="text-align: start">
        <div class="program-info" style="justify-content: flex-start;">
          ${
            p.imageUrl
              ? `<img src="${escapeHtml(
                  p.imageUrl,
                )}" alt="${escapeHtml(p.name || "Scholarship")}" class="program-image" />`
              : `<div class="program-image-placeholder"><i class="fas fa-book-open"></i></div>`
          }
          <div>
            <div class="program-name">${escapeHtml(p.name)}</div>
          </div>
        </div>
      </td>
      <td style="text-align: center">
        <span class="badge badge-blue">${escapeHtml(p.type)}</span>
      </td>
      <td style="text-align: center">${escapeHtml(p.deadline)}</td>
      <td style="text-align: center">${escapeHtml(p.slots)}</td>
      <td style="text-align: center">${escapeHtml(p.createdAt)}</td>
      <td class="program-actions-cell" style="text-align: center; white-space: nowrap">
        <div class="actions-cell-inner">
          <div class="actions-dropdown">
            <button type="button" class="btn btn-sm btn-actions-dropdown-toggle js-actions-dropdown-toggle" data-id="${escapeHtml(p.id)}" title="Actions" aria-label="Actions">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="actions-dropdown-menu">
              <button type="button" class="actions-dropdown-item js-dropdown-view-scholarship" data-id="${escapeHtml(p.id)}"><i class="fas fa-eye"></i> View</button>
              <button type="button" class="actions-dropdown-item js-dropdown-edit" data-id="${escapeHtml(p.id)}"><i class="fas fa-edit"></i> Edit</button>
              <button type="button" class="actions-dropdown-item actions-dropdown-item-danger js-dropdown-delete" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}"><i class="fas fa-trash-alt"></i> Delete</button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  renderTableOrEmpty();
}

function renderTableOrEmpty() {
  const total = filteredPrograms.length;
  if (table) table.style.display = total > 0 ? "table" : "none";
  if (emptyState) emptyState.classList.toggle("hidden", total > 0);
  if (tableFooter) tableFooter.style.display = total > 0 ? "flex" : "none";
}

// --- Type filter dropdown ---
function closeActionsDropdowns() {
  document
    .querySelectorAll(".actions-dropdown-menu.open")
    .forEach((m) => m.classList.remove("open"));
}

function closeAllDropdowns() {
  closeActionsDropdowns();
  typeFilterDropdown?.classList.remove("open");
  typeFilterDropdown?.closest(".date-filter-group")?.classList.remove("active");
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

setupDropdown(typeFilterDropdown);
setupOptionsClick(
  typeFilterDropdown?.querySelector(".dropdown-options"),
  (li) => {
    const val = li.getAttribute("data-value") || "";
    if (typeFilterSelectedLabel)
      typeFilterSelectedLabel.textContent = li.textContent.trim();
    if (typeFilter) typeFilter.value = val;
    typeFilterDropdown
      ?.querySelectorAll(".dropdown-options li")
      .forEach((el) => el.classList.remove("active"));
    li.classList.add("active");
    closeAllDropdowns();
    applyFilters();
  },
);

document.addEventListener("click", closeAllDropdowns);

if (searchBox) searchBox.addEventListener("input", applyFilters);

// --- Pagination ---
if (paginationPrev) {
  paginationPrev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });
}
if (paginationNext) {
  paginationNext.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredPrograms.length / PAGE_SIZE),
    );
    if (currentPage < totalPages) {
      currentPage++;
      renderTable();
    }
  });
}

// --- Add/Edit Modal ---
function showFormMessage(text, type) {
  if (!formMessage) return;
  formMessage.textContent = text;
  formMessage.className = "add-job-form-message " + (type || "");
  formMessage.classList.remove("hidden");
}

function setScholarshipImagePreview(url) {
  const preview = document.getElementById("scholarshipBannerPreview");
  const placeholder = document.getElementById("scholarshipBannerPlaceholder");
  const uploadArea = document.getElementById("scholarshipBannerUploadArea");
  const imageInput = document.getElementById("modalScholarshipImage");
  if (url) {
    if (preview) {
      preview.src = url;
      preview.style.display = "block";
    }
    if (placeholder) placeholder.style.display = "none";
    if (uploadArea) uploadArea.classList.add("has-image");
    if (form) delete form.dataset.removeImage;
  } else {
    if (imageInput) imageInput.value = "";
    if (preview) {
      preview.src = "";
      preview.style.display = "none";
    }
    if (placeholder) placeholder.style.display = "flex";
    if (uploadArea) uploadArea.classList.remove("has-image");
    if (form) form.dataset.removeImage = "true";
  }
}

function openModal(isEdit = false, program = null) {
  if (modalTitle) {
    modalTitle.innerHTML = isEdit
      ? '<i class="fas fa-edit" style="margin-right: 8px;"></i> Edit Scholarship Program'
      : '<i class="fas fa-book-open" style="margin-right: 8px;"></i> Add Scholarship Program';
  }
  if (formSubmitBtn) {
    formSubmitBtn.innerHTML = isEdit
      ? '<i class="fas fa-save"></i> Save Changes'
      : '<i class="far fa-paper-plane"></i> Publish Program';
  }
  if (editProgramIdInput) editProgramIdInput.value = program ? program.id : "";
  if (formMessage) formMessage.classList.add("hidden");

  if (program) {
    form.dataset.editImageUrl = program.imageUrl || "";
    setScholarshipImagePreview(program.imageUrl || "");
    const imageInput = document.getElementById("modalScholarshipImage");
    if (imageInput) imageInput.value = "";
    if (form) delete form.dataset.removeImage;
    document.getElementById("formName").value = program.name || "";
    document.getElementById("formType").value = program.type || "";
    document.getElementById("formDescription").value =
      program.description || "";
    const deadlineInput = document.getElementById("formDeadline");
    if (deadlineInput && program.deadline) {
      const d = new Date(program.deadline);
      deadlineInput.value = isNaN(d.getTime())
        ? ""
        : d.toISOString().split("T")[0];
    } else if (deadlineInput) deadlineInput.value = "";
    document.getElementById("formSlots").value =
      program.slots != null ? String(program.slots) : "";
    const qual = program.qualifications;
    document.getElementById("formQualifications").value = Array.isArray(qual)
      ? qual.join("\n")
      : typeof qual === "string"
        ? qual
        : "";
    const req = program.requirements;
    document.getElementById("formRequirements").value = Array.isArray(req)
      ? req.join("\n")
      : typeof req === "string"
        ? req
        : "";
  } else {
    form.reset();
    if (form) {
      delete form.dataset.editImageUrl;
      delete form.dataset.removeImage;
    }
    setScholarshipImagePreview("");
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

// ---- VIEW SCHOLARSHIP MODAL ----
function openViewScholarshipModal(program) {
  if (!viewScholarshipContent || !viewScholarshipModal) return;

  const title = program.name || "—";
  const typeLabel = program.type || "—";
  const description = program.description || "—";
  const deadline = program.deadline
    ? formatDeadlineDisplay(program.deadline)
    : "—";
  const slots =
    program.slots != null && program.slots !== "" ? String(program.slots) : "—";
  const qual = program.qualifications;
  const requirements = program.requirements;

  const formatList = (val) => {
    if (!val) return "—";
    const arr = Array.isArray(val) ? val : parseListInput(val);
    if (arr.length === 0) return "—";
    return arr.map((s) => escapeHtml(s)).join("\n");
  };

  const qualificationsText = formatList(qual);
  const requirementsText = formatList(requirements);
  const hasImage = Boolean(program.imageUrl);

  viewScholarshipContent.innerHTML = `
    <div class="svm-container">
      <div class="svm-header">
        <div class="svm-header-icon">
          <i class="fas fa-graduation-cap"></i>
        </div>
        <div class="svm-header-text">
          <h2>Scholarship Details</h2>
        </div>
      </div>

      <div class="svm-body">
        <div class="svm-left">
          <div class="svm-image-card ${hasImage ? "has-image" : ""}" aria-label="Scholarship image">
            ${
              hasImage
                ? `<img src="${escapeHtml(
                    program.imageUrl,
                  )}" alt="Scholarship image" />`
                : `
              <div class="svm-image-placeholder">
                <i class="far fa-image"></i>
                <span>No image</span>
              </div>`
            }
          </div>
          <div class="svm-type-row">
            <button type="button" class="svm-type-pill" disabled>
              <span class="svm-type-dot"></span>
              ${escapeHtml(typeLabel)}
            </button>
            <span class="svm-slots-chip">
              <i class="fas fa-users"></i>
              ${escapeHtml(slots)} slots
            </span>
          </div>

          <div class="svm-left-card">
            <span class="svm-card-label">Deadline</span>
            <span class="svm-card-value">${escapeHtml(deadline)}</span>
          </div>
          <div class="svm-left-card">
            <span class="svm-card-label">Slots</span>
            <span class="svm-card-value">${escapeHtml(slots)}</span>
          </div>
        </div>

        <div class="svm-right custom-scrollbar">
          <div class="svm-section">
            <div class="svm-field-label">Name</div>
            <div class="svm-program-name">${escapeHtml(title)}</div>
          </div>

          <hr class="svm-divider" />

          <div class="svm-section">
            <div class="svm-field-label">Description</div>
            <div class="svm-description">${escapeHtml(description)}</div>
          </div>

          ${
            qualificationsText !== "—"
              ? `
          <div class="svm-section">
            <div class="svm-field-label">Eligibility Requirements</div>
            <div class="svm-long-text">${qualificationsText.replace(/\n/g, "<br>")}</div>
          </div>`
              : ""
          }

          ${
            requirementsText !== "—"
              ? `
          <div class="svm-section">
            <div class="svm-field-label">Required Documents</div>
            <div class="svm-long-text">${requirementsText.replace(/\n/g, "<br>")}</div>
          </div>`
              : ""
          }
        </div>
      </div>

      <div class="svm-footer">
        <button type="button" class="svm-btn svm-btn-danger js-svm-delete">
          <i class="fas fa-trash"></i>
          Delete
        </button>
        <button type="button" class="svm-btn svm-btn-primary js-svm-edit">
          <i class="fas fa-pencil-alt"></i>
          Edit Program
        </button>
      </div>
    </div>
  `;

  const editBtn = viewScholarshipContent.querySelector(".js-svm-edit");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      closeViewScholarshipModal();
      openModal(true, program);
    });
  }

  const deleteBtn = viewScholarshipContent.querySelector(".js-svm-delete");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      closeViewScholarshipModal();
      deleteTargetId = program.id || null;
      if (deleteConfirmText) {
        deleteConfirmText.textContent = `Are you sure you want to delete "${title}"? This cannot be undone.`;
      }
      if (deleteModal) {
        deleteModal.classList.add("open");
        deleteModal.setAttribute("aria-hidden", "false");
      }
    });
  }

  viewScholarshipModal.classList.add("open");
  viewScholarshipModal.setAttribute("aria-hidden", "false");
}

function closeViewScholarshipModal() {
  if (viewScholarshipModal) {
    viewScholarshipModal.classList.remove("open");
    viewScholarshipModal.setAttribute("aria-hidden", "true");
  }
}

if (viewScholarshipModalClose)
  viewScholarshipModalClose.addEventListener(
    "click",
    closeViewScholarshipModal,
  );
if (viewScholarshipModal) {
  viewScholarshipModal.addEventListener("click", (e) => {
    if (e.target === viewScholarshipModal) closeViewScholarshipModal();
  });
}

if (document.getElementById("openAddModalBtn")) {
  document
    .getElementById("openAddModalBtn")
    .addEventListener("click", () => openModal(false));
}
if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
if (scholarshipCancelBtn)
  scholarshipCancelBtn.addEventListener("click", closeModal);

if (modal) {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

if (modalClearBtn) {
  modalClearBtn.addEventListener("click", () => {
    const isEdit = editProgramIdInput.value !== "";
    form.reset();
    if (form) {
      delete form.dataset.editImageUrl;
      delete form.dataset.removeImage;
    }
    setScholarshipImagePreview("");
    if (isEdit) {
      modalTitle.innerHTML =
        '<i class="fas fa-edit" style="margin-right: 8px;"></i> Edit Scholarship Program';
      formSubmitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
  });
}

const modalScholarshipImageInput = document.getElementById(
  "modalScholarshipImage",
);
const scholarshipBannerRemoveBtn = document.getElementById(
  "scholarshipBannerRemoveBtn",
);
if (modalScholarshipImageInput) {
  modalScholarshipImageInput.addEventListener("change", function (e) {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (ev) {
        setScholarshipImagePreview(ev.target?.result || "");
      };
      reader.readAsDataURL(file);
    }
  });
}
if (scholarshipBannerRemoveBtn) {
  scholarshipBannerRemoveBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setScholarshipImagePreview("");
  });
}

// Table actions: dropdown toggle + edit / delete
if (tableBody) {
  tableBody.addEventListener("click", (e) => {
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

    const row = e.target?.closest?.(".js-scholarship-row");
    if (row) {
      const excluded = e.target?.closest?.(
        ".js-actions-dropdown-toggle, .actions-dropdown-menu",
      );
      if (!excluded) {
        const id = row.getAttribute("data-id");
        const program = allPrograms.find((p) => p.id === id);
        if (program) openViewScholarshipModal(program);
        return;
      }
    }

    const viewBtn = e.target?.closest?.(".js-dropdown-view-scholarship");
    if (viewBtn) {
      closeActionsDropdowns();
      const id = viewBtn.getAttribute("data-id");
      const program = allPrograms.find((p) => p.id === id);
      if (program) openViewScholarshipModal(program);
      return;
    }

    const editBtn = e.target?.closest?.(".js-dropdown-edit");
    if (editBtn) {
      closeActionsDropdowns();
      const id = editBtn.getAttribute("data-id");
      const program = allPrograms.find((p) => p.id === id);
      if (program) openModal(true, program);
      return;
    }

    const delBtn = e.target?.closest?.(".js-dropdown-delete");
    if (delBtn) {
      closeActionsDropdowns();
      deleteTargetId = delBtn.getAttribute("data-id");
      const name = delBtn.getAttribute("data-name") || "this program";
      if (deleteConfirmText)
        deleteConfirmText.textContent = `Are you sure you want to delete "${name}"? This cannot be undone.`;
      deleteModal.classList.add("open");
      deleteModal.setAttribute("aria-hidden", "false");
    }
  });
}

// Delete modal
function closeDeleteModal() {
  deleteModal.classList.remove("open");
  deleteModal.setAttribute("aria-hidden", "true");
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
      await deleteDoc(doc(db, COLLECTION_NAME, deleteTargetId));
      showSuccess("Scholarship program deleted.");
      if (typeof window.showToast === "function")
        window.showToast("Scholarship program deleted.", "success");
      closeDeleteModal();
      fetchPrograms(true);
    } catch (err) {
      console.error("Delete error:", err);
      showError("Failed to delete: " + err.message);
    } finally {
      deleteConfirmBtn.disabled = false;
    }
  });
}

// --- Form validation & submit ---
function validateForm() {
  const name = getFormValue("formName");
  const type = getFormValue("formType");
  const description = getFormValue("formDescription");
  const deadline = getFormValue("formDeadline");
  const slotsStr = getFormValue("formSlots");

  if (!name) throw new Error("Name is required.");
  if (!type) throw new Error("Type is required.");
  if (!VALID_TYPES.includes(type))
    throw new Error("Type must be OFOP, CITY SCHOLAR, or custom.");
  if (!description) throw new Error("Description is required.");
  if (!deadline) throw new Error("Deadline is required.");
  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime()))
    throw new Error("Please enter a valid deadline date.");
  if (!slotsStr) throw new Error("Slots is required.");
  const slots = parseInt(slotsStr, 10);
  if (isNaN(slots) || slots < 1)
    throw new Error("Slots must be a positive number.");

  return { name, type, description, deadline, slots };
}

async function performScholarshipSubmit() {
  if (formMessage) formMessage.classList.add("hidden");

  const isEdit = getFormValue("editProgramId").length > 0;
  if (formSubmitBtn) {
    formSubmitBtn.disabled = true;
    formSubmitBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Saving...';
  }

  try {
    const { name, type, description, deadline, slots } = validateForm();

    const qualificationsRaw = getFormValue("formQualifications");
    const requirementsRaw = getFormValue("formRequirements");
    const qualifications = parseListInput(qualificationsRaw);
    const requirements = parseListInput(requirementsRaw);

    const deadlineFormatted = formatDeadlineDisplay(deadline);

    const imageFile = modalScholarshipImageInput?.files?.[0] || null;
    const existingImageUrl =
      isEdit && form?.dataset?.editImageUrl ? form.dataset.editImageUrl : "";
    const removeImage = form?.dataset?.removeImage === "true";

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
    } else if (isEdit && existingImageUrl) {
      imageUrl = existingImageUrl;
    }

    const payload = {
      name,
      type,
      description,
      deadline: deadlineFormatted,
      slots: slots,
      qualifications: qualifications.length ? qualifications : null,
      requirements: requirements.length ? requirements : null,
      imageUrl: imageUrl || null,
    };

    if (isEdit) {
      const id = getFormValue("editProgramId");
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      if (typeof window.showToast === "function")
        window.showToast("Saved changes", "success");
    } else {
      const ref = await addDoc(collection(db, COLLECTION_NAME), {
        ...payload,
        createdAt: serverTimestamp(),
      });
      if (typeof window.showToast === "function")
        window.showToast("Scholarship program created.", "success");
      notifyProgramAdded({
        type: "scholarship",
        name: payload.name || "",
        id: ref.id,
      }).catch(() => {});
    }

    setTimeout(() => {
      closeModal();
      fetchPrograms(true);
    }, 500);
  } catch (err) {
    console.error("Submit error:", err);
    showFormMessage(err.message || "An error occurred", "error");
  } finally {
    if (formSubmitBtn) {
      formSubmitBtn.disabled = false;
      formSubmitBtn.innerHTML = isEdit
        ? '<i class="fas fa-save"></i> Save Changes'
        : '<i class="fas fa-paper-plane"></i> Publish Program';
    }
  }
}

// Save changes modal handlers
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
    if (!pendingScholarshipSubmit) return;
    const btn = saveChangesConfirmBtn;
    const icon = btn?.querySelector("i");
    const text = btn?.querySelector(".btn-text");
    btn.disabled = true;
    if (icon) icon.className = "fas fa-spinner fa-spin";
    if (text) text.textContent = "Saving...";

    try {
      await pendingScholarshipSubmit();
      if (saveChangesModal) saveChangesModal.classList.remove("open");
    } finally {
      btn.disabled = false;
      if (icon) icon.className = "fas fa-save";
      if (text) text.textContent = "Save Changes";
      pendingScholarshipSubmit = null;
    }
  });
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const isEdit = getFormValue("editProgramId").length > 0;

    if (isEdit) {
      if (saveChangesModal) {
        pendingScholarshipSubmit = performScholarshipSubmit;
        saveChangesModal.classList.add("open");
      } else {
        await performScholarshipSubmit();
      }
    } else {
      await performScholarshipSubmit();
    }
  });
}
