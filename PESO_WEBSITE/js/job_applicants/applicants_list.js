import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";
import {
  fetchAllApplicants,
  fetchProgramTypeOptions,
  fetchUserProfileImage,
  updateApplicantStatus,
  deleteApplicant,
  updateApplicantDetails,
  normalizeStatus,
  statusBadgeClass,
  formatDisability,
} from "./applicants_core.js";
import { notifyApproval, notifyDecline } from "/js/onesignal/notifications.js";

// --- STATE MANAGEMENT ---
const STATE = {
  allData: [],
  filteredData: [],
  currentPage: 1,
  pageSize: 10,
  currentModalRef: null,
  currentModalData: null,
};

// --- DOM ELEMENTS ---
const UI = {
  tableBody: document.getElementById("applicantsTableBody"),
  loading: document.getElementById("loadingContainer"),
  counts: {
    total: document.getElementById("totalCount"),
    filtered: document.getElementById("filteredCount"),
  },
  inputs: {
    search: document.getElementById("searchBox"),
    dateFilter: document.getElementById("filterDateRange"),
    dateCustom: document.getElementById("customDateInputs"),
    dateFrom: document.getElementById("dateFrom"),
    dateTo: document.getElementById("dateTo"),
    typeFilter: document.getElementById("applicantProgramTypeFilter"),
    statusFilter: document.getElementById("applicantStatusFilter"),
  },
  pagination: {
    prev: document.getElementById("paginationPrev"),
    next: document.getElementById("paginationNext"),
    label: document.getElementById("paginationLabel"),
  },
  modal: {
    self: document.getElementById("applicantInfoModal"),
    content: document.getElementById("applicantInfoModalContent"),
    loading: document.getElementById("applicantInfoModalLoading"),
    error: document.getElementById("applicantInfoModalError"),
    photo: document.getElementById("modalApplicantPhoto"),
    placeholder: document.getElementById("modalApplicantPhotoPlaceholder"),
    editBtn: document.querySelector(".js-edit-applicant-personal"),
    viewNsrp: document.getElementById("modalViewNsrpLink"),
    viewGradeBtn: document.getElementById("modalViewGradeBtn"),
    editContent: document.getElementById("applicantInfoEditContent"),
    editForm: document.getElementById("applicantEditForm"),
    // Tab Elements
    tabs: document.querySelectorAll(".applicant-tab"),
    tabContents: document.querySelectorAll(".applicant-tab-content"),
  },
  gradeModal: {
    self: document.getElementById("gradePreviewModal"),
    frame: document.getElementById("gradePreviewFrame"),
    image: document.getElementById("gradePreviewImage"),
    closeBtn: document.querySelector(".js-close-grade-preview"),
  },
  approveModal: {
    self: document.getElementById("approveModal"),
    confirmBtn: document.querySelector(".js-confirm-approve"),
    closeBtn: document.querySelector(".js-close-approve-modal"),
    remarks: document.getElementById("approveRemarks"),
  },
  declineModal: {
    self: document.getElementById("declineModal"),
    remarks: document.getElementById("declineRemarks"),
    confirmBtn: document.querySelector(".js-confirm-decline"),
    closeBtn: document.querySelector(".js-close-decline-modal"),
  },
  saveChangesModal: {
    self: document.getElementById("saveChangesModal"),
    confirmBtn: document.querySelector(".js-confirm-save-changes"),
    closeBtn: document.querySelector(".js-close-save-changes-modal"),
  },
};

let pendingApplicantSubmit = null;

function setDecisionRemarksVisibility(kind) {
  const name = kind === "approve" ? "approveReason" : "declineReason";
  const wrapId =
    kind === "approve" ? "approveRemarksWrap" : "declineRemarksWrap";
  const remarksId = kind === "approve" ? "approveRemarks" : "declineRemarks";

  const selected = document.querySelector(
    `input[name="${name}"]:checked`,
  )?.value;
  const wrap = document.getElementById(wrapId);
  if (wrap) wrap.classList.toggle("show", selected === "Other");

  // If not Other, ignore any typed remarks by clearing the field
  if (selected !== "Other") {
    const ta = document.getElementById(remarksId);
    if (ta) ta.value = "";
  }
}

function resetDecisionModal(kind) {
  const name = kind === "approve" ? "approveReason" : "declineReason";
  const first = document.querySelector(`input[name="${name}"]`);
  if (first) first.checked = true;
  setDecisionRemarksVisibility(kind);
}

function setApproveModalMode(mode) {
  const modal = UI.approveModal.self;
  if (!modal) return;

  modal.setAttribute(
    "data-status",
    mode === "accept" ? "accepted" : "approved",
  );

  const titleEl = modal.querySelector(".approve-modal-header h3");
  const btnTextEl = modal.querySelector("#approveConfirmBtn .btn-text");

  const firstRadio = modal.querySelector('input[name="approveReason"]');
  if (firstRadio) {
    const isAccept = mode === "accept";
    const labelText = isAccept
      ? "Passed the exam"
      : "Visit our office personally";
    firstRadio.value = labelText;
    const lbl = firstRadio.closest("label");
    if (lbl) lbl.lastChild.textContent = labelText;
  }

  if (titleEl)
    titleEl.textContent =
      mode === "accept" ? "Accept Applicant" : "Approve Applicant";
  if (btnTextEl)
    btnTextEl.textContent = mode === "accept" ? "Accept" : "Approve";

  resetDecisionModal("approve");
}

function setDeclineModalMode(mode) {
  const modal = UI.declineModal.self;
  if (!modal) return;

  modal.setAttribute(
    "data-status",
    mode === "disapprove" ? "disapproved" : "declined",
  );

  const titleEl = modal.querySelector(".decline-modal-header h3");
  const btnTextEl = modal.querySelector("#declineConfirmBtn .btn-text");

  const options = [...modal.querySelectorAll(".decision-radio-option")];
  const radios = [...modal.querySelectorAll('input[name="declineReason"]')];

  if (mode === "decline") {
    // Post-exam: show "Did not pass the exam", "Failure to attend the exam", "Other"
    if (radios[0]) {
      radios[0].value = "Did not pass the exam";
      const lbl0 = radios[0].closest("label");
      if (lbl0) lbl0.lastChild.textContent = "Did not pass the exam";
    }
    if (radios[1]) {
      radios[1].value = "Failure to attend the exam";
      const lbl1 = radios[1].closest("label");
      if (lbl1) lbl1.lastChild.textContent = "Failure to attend the exam";
    }

    options.forEach((opt, idx) => {
      const r = opt.querySelector('input[name="declineReason"]');
      const isOther = r?.value === "Other";
      const keep = idx <= 1 || isOther;
      opt.style.display = keep ? "" : "none";
    });
  } else {
    // Pre-exam disapprove: restore original options
    options.forEach((opt) => (opt.style.display = ""));
    const mapping = [
      { value: "Not a resident", text: "Not a resident" },
      { value: "Not qualified", text: "Not qualified" },
      { value: "Lack of requirements", text: "Lack of requirements" },
      {
        value: "Failure to attend the exam",
        text: "Failure to attend the exam",
      },
      { value: "Other", text: "Other" },
    ];
    radios.forEach((r, i) => {
      if (!mapping[i]) return;
      r.value = mapping[i].value;
      const lbl = r.closest("label");
      if (lbl) lbl.lastChild.textContent = mapping[i].text;
    });
  }

  if (titleEl)
    titleEl.textContent =
      mode === "disapprove" ? "Disapprove Applicant" : "Decline Applicant";
  if (btnTextEl)
    btnTextEl.textContent = mode === "disapprove" ? "Disapprove" : "Decline";

  resetDecisionModal("decline");
}

// --- INITIALIZATION ---
async function init() {
  try {
    if (UI.loading) LoadingOverlay.show(UI.loading);
    if (document.getElementById("applicantsTable"))
      document.getElementById("applicantsTable").style.display = "none";

    STATE.allData = await fetchAllApplicants();

    // Read pre-selected program type from URL (e.g. when coming from Programs page)
    const params = new URLSearchParams(window.location.search);
    const preselectedType = params.get("programType") || "";
    if (UI.inputs.typeFilter) UI.inputs.typeFilter.value = preselectedType;

    // Fetch program type list from jobPrograms to mirror Programs page filter
    const programTypes = await fetchProgramTypeOptions();
    buildApplicantProgramTypeFilterOptions(preselectedType, programTypes);

    applyFilters();
  } catch (err) {
    console.error(err);
    if (UI.tableBody)
      UI.tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading data.</td></tr>`;
  } finally {
    if (UI.loading) LoadingOverlay.hide(UI.loading);
    if (document.getElementById("applicantsTable"))
      document.getElementById("applicantsTable").style.display = "table";
  }
}

// Build the "Program Type" filter options for applicants based on available types
// `programTypes` should come from the same source as the Programs page filter
function buildApplicantProgramTypeFilterOptions(
  selectedType = "",
  programTypes = [],
) {
  const optionsContainer = document.querySelector(
    "#applicantProgramTypeDropdown .dropdown-options",
  );
  const labelEl = document.getElementById("applicantProgramTypeSelectedLabel");
  if (!optionsContainer) return;

  // If a list of types was provided, use it (mirrors Programs page).
  // Fallback: derive from applicants data.
  let orderedTypes =
    Array.isArray(programTypes) && programTypes.length ? programTypes : null;

  if (!orderedTypes) {
    const coreTypes = ["SPES", "GIP", "TUPAD", "JobStart"];
    const typeSet = new Set(coreTypes);

    STATE.allData.forEach((app) => {
      const t = (app.programType || "").trim();
      if (t) typeSet.add(t);
    });

    const extraTypes = [...typeSet]
      .filter((t) => !coreTypes.includes(t))
      .sort();
    orderedTypes = [...coreTypes, ...extraTypes];
  }

  const allTypesActive = !selectedType ? " active" : "";
  let html = `<li data-value="" class="${allTypesActive}">All types</li>`;
  orderedTypes.forEach((t) => {
    const active = selectedType === t ? " active" : "";
    html += `<li data-value="${t}" class="${active}">${t}</li>`;
  });

  optionsContainer.innerHTML = html;

  if (labelEl) {
    labelEl.textContent = selectedType || "All types";
  }
}

// --- FILTERING ---
function applyFilters() {
  const search = UI.inputs.search.value.toLowerCase();
  const type = UI.inputs.typeFilter ? UI.inputs.typeFilter.value : "";
  const status = UI.inputs.statusFilter ? UI.inputs.statusFilter.value : "";
  const dateMode = UI.inputs.dateFilter ? UI.inputs.dateFilter.value : "all";

  // Date Logic
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start = null,
    end = null;

  if (dateMode === "week")
    start = new Date(today.setDate(today.getDate() - today.getDay()));
  else if (dateMode === "month")
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  else if (dateMode === "year") start = new Date(today.getFullYear(), 0, 1);
  else if (dateMode === "custom") {
    if (UI.inputs.dateFrom.value) start = new Date(UI.inputs.dateFrom.value);
    if (UI.inputs.dateTo.value)
      end = new Date(new Date(UI.inputs.dateTo.value).setHours(23, 59, 59));
  }

  STATE.filteredData = STATE.allData.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search) ||
      app.serviceApplied.toLowerCase().includes(search) ||
      (app.reference && app.reference.toLowerCase().includes(search));
    const matchesType = !type || app.programType === type;
    const matchesStatus = !status || app.status === status;
    let matchesDate = true;
    if (app.dateObj && dateMode !== "all") {
      if (start && app.dateObj < start) matchesDate = false;
      if (end && app.dateObj > end) matchesDate = false;
    }
    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });

  STATE.currentPage = 1;
  renderTable();
}

// --- RENDERING ---

function getFirstGradeUrl(app) {
  const raw = app.raw || {};
  let urls =
    raw.spesGradeUrls ||
    raw.gradeUrls ||
    raw.grades ||
    raw.gradeUrl ||
    raw.spesGrades;

  if (!urls) return null;

  // Normalize into an array
  if (typeof urls === "string" || typeof urls === "object") {
    urls = [urls];
  }
  if (!Array.isArray(urls)) return null;

  const normalized = urls
    .map((u) => {
      if (!u) return null;
      if (typeof u === "string") return u;
      if (typeof u === "object") {
        // Handle possible Cloudinary or similar object shapes
        return (
          u.secure_url ||
          u.url ||
          u.href ||
          (typeof u.toString === "function" ? u.toString() : null)
        );
      }
      return null;
    })
    .filter((u) => typeof u === "string" && u.trim().length > 0);

  return normalized.length ? normalized[0] : null;
}

function renderTable() {
  if (!UI.tableBody) return;
  const { filteredData, currentPage, pageSize } = STATE;
  const start = (currentPage - 1) * pageSize;
  const pageData = filteredData.slice(start, start + pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));

  // Counts
  if (UI.counts.total) UI.counts.total.textContent = STATE.allData.length;
  if (UI.counts.filtered) UI.counts.filtered.textContent = filteredData.length;

  // Pagination UI
  if (UI.pagination.label)
    UI.pagination.label.textContent = `Page ${currentPage} of ${totalPages}`;
  UI.pagination.prev.setAttribute("aria-disabled", currentPage <= 1);
  UI.pagination.next.setAttribute("aria-disabled", currentPage >= totalPages);

  if (pageData.length === 0) {
    UI.tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No applicants found</td></tr>`;
    return;
  }

  UI.tableBody.innerHTML = pageData
    .map((app) => {
      const isSpes = (app.programType || "").toString().trim() === "SPES";
      const status = app.status;

      let decisionHtml = "";

      if (
        status === "Accepted" ||
        status === "Declined" ||
        status === "Disapproved"
      ) {
        decisionHtml = "";
      } else if (isSpes && status === "Approved") {
        decisionHtml = `
            <button class="actions-dropdown-item js-approve" data-action="accept" data-ref="${encodeURIComponent(
              app.path,
            )}"><i class="fas fa-check"></i> Accept</button>
            <button class="actions-dropdown-item js-decline" data-action="decline" data-ref="${encodeURIComponent(
              app.path,
            )}"><i class="fas fa-times"></i> Decline</button>
        `;
      } else if (isSpes && status === "In Progress") {
        decisionHtml = `
            <button class="actions-dropdown-item js-approve" data-action="approve" data-ref="${encodeURIComponent(
              app.path,
            )}"><i class="fas fa-check"></i> Approve</button>
            <button class="actions-dropdown-item js-decline" data-action="disapprove" data-ref="${encodeURIComponent(
              app.path,
            )}"><i class="fas fa-times"></i> Disapprove</button>
        `;
      } else {
        decisionHtml = `
            <button class="actions-dropdown-item js-approve" data-action="approve" data-ref="${encodeURIComponent(
              app.path,
            )}"><i class="fas fa-check"></i> Approve</button>
            <button class="actions-dropdown-item js-decline" data-action="decline" data-ref="${encodeURIComponent(
              app.path,
            )}"><i class="fas fa-times"></i> Decline</button>
        `;
      }

      return `
    <tr>
      <td class="text-start">
        <div class="fw-bold">${app.reference || "—"}</div>
      </td>
      <td class="text-start">
        <div class="fw-bold">${app.name}</div>
      </td>
      <td class="text-center">
        <span class="badge applicant-service-badge">${app.serviceApplied}</span>
      </td>
      <td class="text-center">${app.dateStr}</td>
      <td class="text-center">
        <span class="badge applicant-status-badge ${statusBadgeClass(
          app.status,
        )}">${app.status}</span>
      </td>
      <td class="text-center">
        <div class="actions-dropdown">
          <button class="btn btn-sm btn-actions-dropdown-toggle js-actions-dropdown-toggle" title="Actions">
            <i class="fas fa-ellipsis-v"></i>
          </button>
          <div class="actions-dropdown-menu">
            <button class="actions-dropdown-item js-view" data-ref="${encodeURIComponent(
              app.path,
            )}"><i class="fas fa-eye"></i> View</button>
            ${decisionHtml}
            <button class="actions-dropdown-item actions-dropdown-item-danger js-delete" data-ref="${encodeURIComponent(
              app.path,
            )}"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </div>
      </td>
    </tr>
  `;
    })
    .join("");
}

// --- MODAL & IMAGE LOGIC ---
async function handleViewApplicant(path) {
  // 1. Find Data locally first (Instant Load)
  const app = STATE.allData.find((a) => a.path === path);
  if (!app) return;

  STATE.currentModalRef = path;
  STATE.currentModalData = app.raw;

  // Reset tabs to default (Personal)
  resetModalTabs();

  UI.modal.self.classList.add("open");
  UI.modal.content.style.display = "none";
  UI.modal.editContent.style.display = "none";
  UI.modal.loading.style.display = "block";
  UI.modal.error.style.display = "none";

  // 2. FETCH USER PROFILE IMAGE
  let imgUrl =
    app.raw.profileimageurl || app.raw.profileImageUrl || app.raw.photoURL;

  if (!imgUrl) {
    let userId = app.raw.userId || app.raw.uid;
    if (!userId && path.startsWith("users/")) {
      const parts = path.split("/");
      if (parts.length >= 2) userId = parts[1];
    }

    if (userId) {
      const fetchedImg = await fetchUserProfileImage(userId);
      if (fetchedImg) {
        imgUrl = fetchedImg;
        app.raw.profileimageurl = fetchedImg;
      }
    }
  }

  // 3. Populate Modal
  populateModalUI(app.raw, imgUrl);

  UI.modal.loading.style.display = "none";
  UI.modal.content.style.display = "block";

  // Setup Links
  const detailsUrl = `/pages/job_applicants/applicant_details.html?ref=${encodeURIComponent(path)}`;
  UI.modal.viewNsrp.href = detailsUrl;
  UI.modal.viewNsrp.style.display = "inline-flex";
  UI.modal.editBtn.style.display = "inline-flex";

  // Setup Grade button (if any grade URL)
  if (UI.modal.viewGradeBtn) {
    const gradeUrl = getFirstGradeUrl(app);
    if (gradeUrl) {
      UI.modal.viewGradeBtn.style.display = "inline-flex";
      UI.modal.viewGradeBtn.onclick = () => {
        if (UI.gradeModal.self) {
          const isImage =
            /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(gradeUrl) ||
            gradeUrl.startsWith("data:image/");

          if (UI.gradeModal.image) {
            UI.gradeModal.image.style.display = isImage ? "block" : "none";
            UI.gradeModal.image.src = isImage ? gradeUrl : "";
          }

          if (UI.gradeModal.frame) {
            UI.gradeModal.frame.style.display = isImage ? "none" : "block";
            UI.gradeModal.frame.src = isImage ? "" : gradeUrl;
          }

          UI.gradeModal.self.classList.add("open");
        } else {
          // Fallback: open in new tab if modal not available
          window.open(gradeUrl, "_blank", "noopener");
        }
      };
    } else {
      UI.modal.viewGradeBtn.style.display = "none";
      UI.modal.viewGradeBtn.onclick = null;
    }
  }
}

function resetModalTabs() {
  UI.modal.tabs.forEach((t, i) => {
    if (i === 0) t.classList.add("active");
    else t.classList.remove("active");
  });
  UI.modal.tabContents.forEach((c, i) => {
    if (i === 0) c.classList.add("active");
    else c.classList.remove("active");
  });
}

function populateModalUI(data, forceImgUrl) {
  const imgUrl = (
    forceImgUrl ||
    data.profileimageurl ||
    data.profileImageUrl ||
    ""
  ).trim();
  const initials = (data.firstName?.[0] || "") + (data.surname?.[0] || "");

  // Image
  UI.modal.photo.style.display = "none";
  UI.modal.placeholder.style.display = "flex";
  UI.modal.placeholder.innerHTML = initials
    ? initials.toUpperCase()
    : '<i class="fas fa-user"></i>';

  if (imgUrl) {
    UI.modal.photo.onload = () => {
      UI.modal.photo.style.display = "block";
      UI.modal.placeholder.style.display = "none";
    };
    UI.modal.photo.src = imgUrl;
  }

  // Helper Set
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "—";
  };

  // Name
  const nameParts = [
    data.firstName,
    data.middleName,
    data.surname,
    data.suffix,
  ].filter((p) => p && p !== "None");
  set("modalApplicantName", nameParts.join(" "));
  set("modalApplicantEmail", data.email);
  set("modalApplicantContact", data.contactNumber);

  // Grid Fields - Personal
  set("modalApplicantFirstName", data.firstName);
  set("modalApplicantMiddleName", data.middleName);
  set("modalApplicantSurname", data.surname);
  set("modalApplicantSuffix", data.suffix);
  set("modalApplicantDob", data.dateOfBirth);
  set("modalApplicantSex", data.sex);
  set("modalApplicantReligion", data.religion);
  set("modalApplicantCivilStatus", data.civilStatus);

  // Grid Fields - Address
  set("modalApplicantHouseStreet", data.addressHouse || data.addressStreet);
  set("modalApplicantBarangay", data.addressBarangay || data.addressCity);
  set(
    "modalApplicantMunicipalityCity",
    data.addressMunicipality || data.addressCity || data.addressProvince,
  );
  set("modalApplicantProvince", data.addressProvince);

  // Grid Fields - Other
  set(
    "modalApplicantEmployment",
    data.employed === true ? "Employed" : "Unemployed",
  );

  // TIN requires special check to match design (gray italic if empty)
  const tinEl = document.getElementById("modalApplicantTin");
  if (tinEl) {
    if (data.tin && data.tin !== "None") {
      tinEl.textContent = data.tin;
      tinEl.classList.remove("text-muted");
      tinEl.style.fontStyle = "normal";
    } else {
      tinEl.textContent = "Not provided";
      tinEl.classList.add("text-muted");
      tinEl.style.fontStyle = "italic";
    }
  }

  set("modalApplicantDisability", formatDisability(data));
  set("modalApplicantReason", data.whyChooseProgram || data.reason);

  // Status Badge
  const status = normalizeStatus(data.applicationStatus || data.status);
  const badge = document.getElementById("modalApplicantStatusBadge");
  if (badge) {
    badge.textContent = status;
    badge.className = `applicant-info-status-badge ${statusBadgeClass(status)}`;
    badge.style.display = "inline-block";
  }

  // Program Badge
  const serviceText =
    data.serviceApplied ||
    data.jobServiceApplied ||
    data.jobProgramName ||
    data.jobProgram ||
    data.programType ||
    "";

  const progBadge = document.getElementById("modalApplicantProgramBadge");
  if (progBadge) {
    progBadge.textContent = serviceText || "—";
    progBadge.style.display = serviceText ? "inline-block" : "none";
  }
}

// --- HELPERS FOR DROPDOWN ---
function closeActionsDropdowns() {
  document
    .querySelectorAll(".actions-dropdown-menu.open")
    .forEach((m) => m.classList.remove("open"));
}

// --- EVENT LISTENERS ---

// Table Actions (Delegation with Smart Positioning)
UI.tableBody.addEventListener("click", async (e) => {
  // 1. DROPDOWN TOGGLE LOGIC
  const toggleBtn = e.target.closest(".js-actions-dropdown-toggle");
  if (toggleBtn) {
    e.preventDefault();
    e.stopPropagation();

    const menu = toggleBtn.nextElementSibling;
    const isAlreadyOpen = menu.classList.contains("open");

    // Close all other dropdowns first
    closeActionsDropdowns();

    if (!isAlreadyOpen) {
      menu.classList.add("open");

      // --- SMART POSITIONING ---
      requestAnimationFrame(() => {
        const rect = toggleBtn.getBoundingClientRect();
        const menuWidth = 140;
        const menuHeight = 160;
        const gap = 4;

        let left = rect.right - menuWidth;
        let top = rect.bottom + gap;

        if (top + menuHeight > window.innerHeight) {
          top = rect.top - menuHeight - gap;
        }

        menu.style.position = "fixed";
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;
        menu.style.zIndex = "9999";
        menu.style.width = `${menuWidth}px`;
      });
    }
    return;
  }

  // 2. ACTION BUTTONS LOGIC
  const btn = e.target.closest("button");
  if (!btn) return;

  const path = decodeURIComponent(btn.getAttribute("data-ref") || "");
  if (!path) return;

  if (btn.classList.contains("js-view")) {
    closeActionsDropdowns();
    handleViewApplicant(path);
  } else if (btn.classList.contains("js-approve")) {
    closeActionsDropdowns();
    UI.approveModal.self.classList.add("open");
    UI.approveModal.self.setAttribute("data-target", path);
    const action = btn.getAttribute("data-action") || "approve";
    setApproveModalMode(action === "accept" ? "accept" : "approve");
  } else if (btn.classList.contains("js-decline")) {
    closeActionsDropdowns();
    UI.declineModal.self.classList.add("open");
    UI.declineModal.self.setAttribute("data-target", path);
    const action = btn.getAttribute("data-action") || "decline";
    setDeclineModalMode(action === "disapprove" ? "disapprove" : "decline");
  } else if (btn.classList.contains("js-delete")) {
    closeActionsDropdowns();
    if (confirm("Delete permanently?")) {
      await deleteApplicant(path);
      STATE.allData = STATE.allData.filter((i) => i.path !== path);
      applyFilters();
      window.showToast("Deleted successfully", "success");
    }
  }
});

// TABS LOGIC
UI.modal.tabs.forEach((tab) => {
  tab.addEventListener("click", (e) => {
    const targetId = e.currentTarget.getAttribute("data-target");

    // Deactivate all
    UI.modal.tabs.forEach((t) => t.classList.remove("active"));
    UI.modal.tabContents.forEach((c) => c.classList.remove("active"));

    // Activate target
    e.currentTarget.classList.add("active");
    document.getElementById(targetId).classList.add("active");
  });
});

// Window Resize/Scroll - Close dropdowns
window.addEventListener("scroll", closeActionsDropdowns, true);
window.addEventListener("resize", closeActionsDropdowns);

// Filters
UI.inputs.search.addEventListener("input", applyFilters);
UI.inputs.dateFilter.addEventListener("change", () => {
  UI.inputs.dateCustom.classList.toggle(
    "hidden",
    UI.inputs.dateFilter.value !== "custom",
  );
  applyFilters();
});
UI.inputs.dateFrom.addEventListener("change", applyFilters);
UI.inputs.dateTo.addEventListener("change", applyFilters);

// Custom Dropdowns (Visuals) - use event delegation so dynamic options work
document.querySelectorAll(".custom-dropdown").forEach((dd) => {
  dd.addEventListener("click", (e) => {
    // Only toggle when clicking the dropdown shell, not an option
    if (e.target.closest(".dropdown-options")) return;
    e.stopPropagation();
    dd.classList.toggle("open");
  });

  const optionsContainer = dd.querySelector(".dropdown-options");
  if (!optionsContainer) return;

  optionsContainer.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    e.stopPropagation();

    const val = li.getAttribute("data-value");
    const inputId =
      dd.id === "customDateDropdown"
        ? "filterDateRange"
        : "applicantProgramTypeFilter";
    const displayId =
      dd.id === "customDateDropdown"
        ? "currentDateFilter"
        : "applicantProgramTypeSelectedLabel";

    const inputEl = document.getElementById(inputId);
    const displayEl = document.getElementById(displayId);
    if (inputEl) inputEl.value = val;
    if (displayEl) displayEl.textContent = li.textContent.trim();

    optionsContainer
      .querySelectorAll("li")
      .forEach((x) => x.classList.remove("active"));
    li.classList.add("active");

    if (inputId === "filterDateRange") {
      UI.inputs.dateCustom.classList.toggle("hidden", val !== "custom");
    }
    applyFilters();
    dd.classList.remove("open");
  });
});

// Status Pills
document
  .getElementById("applicantStatusPills")
  ?.addEventListener("click", (e) => {
    if (e.target.classList.contains("applicant-filter-cell")) {
      document
        .querySelectorAll(".applicant-filter-cell")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      UI.inputs.statusFilter.value = e.target.getAttribute("data-value");
      applyFilters();
    }
  });

// Pagination
UI.pagination.prev.addEventListener("click", () => {
  if (STATE.currentPage > 1) {
    STATE.currentPage--;
    renderTable();
  }
});
UI.pagination.next.addEventListener("click", () => {
  const max = Math.ceil(STATE.filteredData.length / STATE.pageSize);
  if (STATE.currentPage < max) {
    STATE.currentPage++;
    renderTable();
  }
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (!t || t.tagName !== "INPUT") return;
  if (t.name === "approveReason") setDecisionRemarksVisibility("approve");
  if (t.name === "declineReason") setDecisionRemarksVisibility("decline");
});

// Approve Modal Actions
UI.approveModal.confirmBtn?.addEventListener("click", async () => {
  const path = UI.approveModal.self.getAttribute("data-target");
  const btn = UI.approveModal.confirmBtn;
  if (!path) return;
  const statusToSet =
    UI.approveModal.self.getAttribute("data-status") || "approved";
  const selectedReason =
    document.querySelector('input[name="approveReason"]:checked')?.value ||
    null;
  const rawRemarks = UI.approveModal.remarks?.value || "";
  const useRemarks = selectedReason === "Other";
  const remarks = useRemarks ? rawRemarks : "";
  const reason = useRemarks ? rawRemarks.trim() || "Other" : selectedReason;
  const item = STATE.allData.find((i) => i.path === path);
  const userId =
    item?.raw?.userId ||
    item?.raw?.uid ||
    item?.raw?.applicantUserId ||
    item?.raw?.applicantId ||
    null;
  const icon = btn?.querySelector("i");
  const text = btn?.querySelector(".btn-text");
  btn.disabled = true;
  if (icon) icon.className = "fas fa-spinner fa-spin";
  if (text)
    text.textContent =
      statusToSet === "accepted" ? "Accepting..." : "Approving...";
  try {
    await updateApplicantStatus(path, statusToSet, remarks, userId, reason);
    if (item) item.status = normalizeStatus(statusToSet);
    applyFilters();
    UI.approveModal.self.classList.remove("open");
    if (UI.approveModal.remarks) UI.approveModal.remarks.value = "";
    resetDecisionModal("approve");
    window.showToast(
      statusToSet === "accepted"
        ? "Accepted successfully"
        : "Approved successfully",
      "success",
    );
    if (item) {
      const notifyRemarks =
        (typeof remarks === "string" && remarks.trim()) || reason || "";
      notifyApproval({
        applicantName: item.name,
        programName: item.programType,
        type: "job",
        applicantId: userId,
        decision: statusToSet,
        remarks: notifyRemarks,
      }).catch(() => {});
    }
  } finally {
    btn.disabled = false;
    if (icon) icon.className = "fas fa-check-circle";
    if (text)
      text.textContent =
        (UI.approveModal.self.getAttribute("data-status") || "approved") ===
        "accepted"
          ? "Accept"
          : "Approve";
  }
});

UI.approveModal.closeBtn?.addEventListener("click", () => {
  UI.approveModal.self.classList.remove("open");
  if (UI.approveModal.remarks) UI.approveModal.remarks.value = "";
  setApproveModalMode("approve");
});

// Decline Modal Actions
UI.declineModal.confirmBtn?.addEventListener("click", async () => {
  const path = UI.declineModal.self.getAttribute("data-target");
  const rawRemarks = UI.declineModal.remarks?.value || "";
  const btn = UI.declineModal.confirmBtn;
  if (!path) return;
  const statusToSet =
    UI.declineModal.self.getAttribute("data-status") || "declined";
  const selectedReason =
    document.querySelector('input[name="declineReason"]:checked')?.value ||
    null;
  const useRemarks = selectedReason === "Other";
  const remarks = useRemarks ? rawRemarks : "";
  const reason = useRemarks ? rawRemarks.trim() || "Other" : selectedReason;
  const item = STATE.allData.find((i) => i.path === path);
  const userId =
    item?.raw?.userId ||
    item?.raw?.uid ||
    item?.raw?.applicantUserId ||
    item?.raw?.applicantId ||
    null;
  const icon = btn?.querySelector("i");
  const text = btn?.querySelector(".btn-text");
  btn.disabled = true;
  if (icon) icon.className = "fas fa-spinner fa-spin";
  if (text)
    text.textContent =
      statusToSet === "disapproved" ? "Disapproving..." : "Declining...";
  try {
    await updateApplicantStatus(path, statusToSet, remarks, userId, reason);
    if (item) item.status = normalizeStatus(statusToSet);
    applyFilters();
    UI.declineModal.self.classList.remove("open");
    if (UI.declineModal.remarks) UI.declineModal.remarks.value = "";
    resetDecisionModal("decline");
    window.showToast(
      statusToSet === "disapproved"
        ? "Disapproved successfully"
        : "Declined successfully",
      "success",
    );
    if (item) {
      const notifyRemarks =
        (typeof remarks === "string" && remarks.trim()) || reason || "";
      notifyDecline({
        applicantName: item.name,
        programName: item.programType,
        type: "job",
        remarks: notifyRemarks,
        applicantId: userId,
        decision: statusToSet,
      }).catch(() => {});
    }
  } finally {
    btn.disabled = false;
    if (icon) icon.className = "fas fa-times-circle";
    if (text)
      text.textContent =
        (UI.declineModal.self.getAttribute("data-status") || "declined") ===
        "disapproved"
          ? "Disapprove"
          : "Decline";
  }
});

// Global Closer
document.addEventListener("click", (e) => {
  if (!e.target.closest(".actions-dropdown")) {
    closeActionsDropdowns();
  }
  if (!e.target.closest(".custom-dropdown")) {
    document
      .querySelectorAll(".custom-dropdown.open")
      .forEach((m) => m.classList.remove("open"));
  }
  if (e.target === UI.modal.self) UI.modal.self.classList.remove("open");
  if (e.target === UI.approveModal.self) {
    UI.approveModal.self.classList.remove("open");
    if (UI.approveModal.remarks) UI.approveModal.remarks.value = "";
    setApproveModalMode("approve");
  }
  if (e.target === UI.declineModal.self) {
    UI.declineModal.self.classList.remove("open");
    if (UI.declineModal.remarks) UI.declineModal.remarks.value = "";
    setDeclineModalMode("decline");
  }
  if (e.target === UI.gradeModal.self) {
    UI.gradeModal.self.classList.remove("open");
    if (UI.gradeModal.frame) {
      UI.gradeModal.frame.src = "";
      UI.gradeModal.frame.style.display = "block";
    }
    if (UI.gradeModal.image) {
      UI.gradeModal.image.src = "";
      UI.gradeModal.image.style.display = "none";
    }
  }
});

document
  .querySelectorAll(".js-close-applicant-modal")
  .forEach((el) =>
    el.addEventListener("click", () => UI.modal.self.classList.remove("open")),
  );

document.querySelectorAll(".js-close-approve-modal").forEach((el) =>
  el.addEventListener("click", () => {
    UI.approveModal.self.classList.remove("open");
    if (UI.approveModal.remarks) UI.approveModal.remarks.value = "";
    setApproveModalMode("approve");
  }),
);

document.querySelectorAll(".js-close-decline-modal").forEach((el) =>
  el.addEventListener("click", () => {
    UI.declineModal.self.classList.remove("open");
    if (UI.declineModal.remarks) UI.declineModal.remarks.value = "";
    setDeclineModalMode("decline");
  }),
);

UI.gradeModal.closeBtn?.addEventListener("click", () => {
  UI.gradeModal.self.classList.remove("open");
  if (UI.gradeModal.frame) {
    UI.gradeModal.frame.src = "";
    UI.gradeModal.frame.style.display = "block";
  }
  if (UI.gradeModal.image) {
    UI.gradeModal.image.src = "";
    UI.gradeModal.image.style.display = "none";
  }
});

// Edit Mode Interactions
UI.modal.editBtn?.addEventListener("click", () => {
  UI.modal.content.style.display = "none";
  UI.modal.editContent.style.display = "block";
  const d = STATE.currentModalData;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || "";
  };

  // Pre-fill fields
  setVal("editSurname", d.surname);
  setVal("editFirstName", d.firstName);
  setVal("editMiddleName", d.middleName);
  setVal("editSuffix", d.suffix);
  setVal("editDateOfBirth", d.dateOfBirth);
  setVal("editSex", d.sex);
  setVal("editReligion", d.religion);
  setVal("editCivilStatus", d.civilStatus);
  setVal("editHouseStreet", d.addressHouse || d.addressStreet);
  setVal("editBarangay", d.addressBarangay || d.addressCity);
  setVal(
    "editMunicipalityCity",
    d.addressMunicipality || d.addressCity || d.addressProvince,
  );
  setVal("editProvince", d.addressProvince);
  setVal("editContactNumber", d.contactNumber);
  setVal("editEmail", d.email);
  setVal("editTin", d.tin);
  const empSelect = document.getElementById("editEmployed");
  if (empSelect)
    empSelect.value =
      d.employed === true ? "true" : d.employed === false ? "false" : "";
});

document.querySelector(".js-cancel-edit")?.addEventListener("click", () => {
  UI.modal.content.style.display = "block";
  UI.modal.editContent.style.display = "none";
});

async function performApplicantSubmit() {
  const getVal = (id) => document.getElementById(id)?.value?.trim() || null;

  const updates = {
    surname: getVal("editSurname"),
    firstName: getVal("editFirstName"),
    middleName: getVal("editMiddleName"),
    suffix: getVal("editSuffix"),
    dateOfBirth: getVal("editDateOfBirth"),
    sex: getVal("editSex"),
    religion: getVal("editReligion"),
    civilStatus: getVal("editCivilStatus"),
    addressHouse: getVal("editHouseStreet"),
    addressBarangay: getVal("editBarangay"),
    addressMunicipality: getVal("editMunicipalityCity"),
    addressProvince: getVal("editProvince"),
    contactNumber: getVal("editContactNumber"),
    email: getVal("editEmail"),
    tin: getVal("editTin"),
  };

  const empStr = getVal("editEmployed");
  if (empStr === "true") updates.employed = true;
  else if (empStr === "false") updates.employed = false;

  await updateApplicantDetails(STATE.currentModalRef, updates);

  // Update local state
  Object.assign(STATE.currentModalData, updates);

  // Update Table item name
  const item = STATE.allData.find((i) => i.path === STATE.currentModalRef);
  if (item) {
    const nameParts = [
      updates.firstName,
      updates.middleName,
      updates.surname,
      updates.suffix,
    ].filter((p) => p && p !== "None");
    item.name = nameParts.join(" ");
  }

  populateModalUI(STATE.currentModalData);
  UI.modal.content.style.display = "block";
  UI.modal.editContent.style.display = "none";
  renderTable();
  window.showToast("Saved changes", "success");
}

// Save changes modal handlers
if (UI.saveChangesModal.self) {
  UI.saveChangesModal.closeBtn?.addEventListener("click", () => {
    UI.saveChangesModal.self.classList.remove("open");
  });
  UI.saveChangesModal.self.addEventListener("click", (e) => {
    if (e.target === UI.saveChangesModal.self) {
      UI.saveChangesModal.self.classList.remove("open");
    }
  });
}

if (UI.saveChangesModal.confirmBtn) {
  UI.saveChangesModal.confirmBtn.addEventListener("click", async () => {
    if (!pendingApplicantSubmit) return;
    const btn = UI.saveChangesModal.confirmBtn;
    const icon = btn?.querySelector("i");
    const text = btn?.querySelector(".btn-text");
    btn.disabled = true;
    if (icon) icon.className = "fas fa-spinner fa-spin";
    if (text) text.textContent = "Saving...";

    try {
      await pendingApplicantSubmit();
      if (UI.saveChangesModal.self)
        UI.saveChangesModal.self.classList.remove("open");
    } finally {
      btn.disabled = false;
      if (icon) icon.className = "fas fa-save";
      if (text) text.textContent = "Save Changes";
      pendingApplicantSubmit = null;
    }
  });
}

UI.modal.editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (UI.saveChangesModal.self) {
    pendingApplicantSubmit = performApplicantSubmit;
    UI.saveChangesModal.self.classList.add("open");
  } else {
    await performApplicantSubmit();
  }
});

// START: require login for this page
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/pages/login/login.html";
    return;
  }
  document.documentElement.classList.remove("auth-pending");
  init();
});
