import { db } from "/js/config/firebase.js";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "/js/config/firebase.js";
import {
  notifyApproval,
  notifyDecline,
  resolveApplicantFirebaseUid,
} from "/js/onesignal/notifications.js";
import { createApplicationDecisionNotification } from "/js/notifications/notification_store.js";

const PERIOD_LABELS = {
  junior_high_new: "Junior High – New",
  junior_high_renewal: "Junior High – Renewal",
  senior_high_new: "Senior High – New",
  senior_high_renewal: "Senior High – Renewal",
  college_new: "College – New",
  college_renewal: "College – Renewal",
};

const STATUS_BUCKETS = ["Accepted", "Pending", "Renewal", "Declined", "Other"];

const els = {
  loading: document.getElementById("loadingContainer"),
  error: document.getElementById("errorContainer"),
  searchBox: document.getElementById("searchBox"),
  totalCount: document.getElementById("totalCount"),
  results: document.getElementById("resultsContainer"),

  statusPills: document.getElementById("scholarStatusPills"),
  statusFilter: document.getElementById("scholarStatusFilter"),

  tabs: document.getElementById("scholarTabs"),
  levelDropdown: document.getElementById("scholarLevelDropdown"),
  levelSelectedLabel: document.getElementById("scholarLevelSelectedLabel"),
  levelFilter: document.getElementById("scholarLevelFilter"),

  typeDropdown: document.getElementById("scholarTypeDropdown"),
  typeSelectedLabel: document.getElementById("scholarTypeSelectedLabel"),
  typeFilter: document.getElementById("scholarTypeFilter"),

  dateDropdown: document.getElementById("scholarDateDropdown"),
  dateSelectedLabel: document.getElementById("scholarCurrentDateFilter"),
  dateFilter: document.getElementById("scholarFilterDateRange"),
  customDateInputs: document.getElementById("scholarCustomDateInputs"),
  dateFrom: document.getElementById("scholarDateFrom"),
  dateTo: document.getElementById("scholarDateTo"),

  tableBody: document.getElementById("scholarshipAppliedTableBody"),
  filteredCount: document.getElementById("filteredCount"),
  totalCountFooter: document.getElementById("totalCountFooter"),
  paginationPrev: document.getElementById("paginationPrev"),
  paginationNext: document.getElementById("paginationNext"),
  paginationLabel: document.getElementById("paginationLabel"),

  modal: document.getElementById("scholarshipInfoModal"),
  modalContent: document.getElementById("scholarshipInfoModalContent"),
  modalName: document.getElementById("modalScholarName"),
  modalEmail: document.getElementById("modalScholarEmail"),
  modalStatusBadge: document.getElementById("modalScholarStatusBadge"),
  modalTypeBadge: document.getElementById("modalScholarTypeBadge"),
  modalGrid: document.getElementById("modalScholarDetailsGrid"),
};

let tabFilter = "all"; // "all" | "new" | "renewal"

let allApplications = [];
const PAGE_SIZE = 10;
let currentPage = 1;

// Store refs for safe updateDoc
const documentRefsByPath = new Map();
// Keep latest visible list for pagination
let filteredApplications = [];

function showError(msg) {
  if (!els.error) return;
  els.error.innerHTML = `<div class="error-msg">${escapeHtml(msg)}</div>`;
}

function clearError() {
  if (!els.error) return;
  els.error.innerHTML = "";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function toTitleCase(s) {
  return (s || "")
    .toString()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getScholarName(data) {
  const parts = [
    data.firstName,
    data.middleName,
    data.surname,
    data.suffix,
  ].filter(
    (p) => p && (p + "").trim() !== "" && (p + "").toLowerCase() !== "none",
  );
  return parts.join(" ") || data.fullName || data.name || "—";
}

function getScholarshipTypeRaw(data) {
  return (
    data.periodId ||
    data.scholarshipPeriodId ||
    data.scholarshipType ||
    data.applicationType ||
    data.type ||
    data.level ||
    data.program ||
    ""
  );
}

function getLevelFromType(raw) {
  const s = (raw || "").toString().trim().toLowerCase();
  if (s.includes("junior") || s.includes("jhs")) return "JHS";
  if (s.includes("senior") || s.includes("shs")) return "SHS";
  if (s.includes("college")) return "College";
  return "";
}

function formatScholarshipType(raw) {
  const key = (raw || "").toString().trim();
  if (!key) return "—";
  if (PERIOD_LABELS[key]) return PERIOD_LABELS[key];
  return toTitleCase(key);
}

function getAppliedDate(data) {
  const t =
    data.createdAt ||
    data.submittedAt ||
    data.appliedAt ||
    data.timestamp ||
    data.updatedAt ||
    null;
  if (!t) return { dateObj: null, dateStr: "—" };
  const d = t.toDate ? t.toDate() : new Date(t);
  if (isNaN(d.getTime())) return { dateObj: null, dateStr: "—" };
  return { dateObj: d, dateStr: d.toLocaleDateString() };
}

function normalizeStatus(rawStatus) {
  const s = (rawStatus || "").toString().trim().toLowerCase();
  if (!s) return "Pending";
  if (["accepted", "approve", "approved", "passed", "qualified"].includes(s))
    return "Accepted";
  if (["declined", "decline", "rejected", "reject", "denied"].includes(s))
    return "Declined";
  if (["renewal", "renew"].includes(s)) return "Renewal";
  if (["pending", "in progress", "processing", "for review"].includes(s))
    return "Pending";
  return "Other";
}

function isRenewalApplication(data) {
  if (data.isRenewal === true || data.renewal === true) return true;
  const raw = getScholarshipTypeRaw(data);
  return (raw || "").toString().toLowerCase().includes("renewal");
}

function bucketFor(data) {
  // If it is a renewal application, prioritize the Renewal table (matches the request).
  if (isRenewalApplication(data)) return "Renewal";
  const rawStatus =
    data.applicationStatus ||
    data.pesoStatus ||
    data.status ||
    data.scholarshipStatus ||
    "";
  const normalized = normalizeStatus(rawStatus);
  if (STATUS_BUCKETS.includes(normalized)) return normalized;
  return "Other";
}

function statusBadgeClass(bucket) {
  // Match Applicants table badge style (Bootstrap bg-* + optional text-dark)
  const b = (bucket || "").toLowerCase();
  if (b === "accepted") return "badge bg-success";
  if (b === "declined") return "badge bg-danger";
  if (b === "pending") return "badge bg-warning text-dark";
  if (b === "renewal") return "badge bg-primary";
  if (b === "other") return "badge bg-secondary";
  return "badge bg-secondary";
}

function closeActionsDropdowns() {
  document
    .querySelectorAll(".actions-dropdown-menu.open")
    .forEach((m) => m.classList.remove("open"));
}

function closeAllDropdowns() {
  closeActionsDropdowns();
  els.levelDropdown?.classList.remove("open");
  els.typeDropdown?.classList.remove("open");
  els.dateDropdown?.classList.remove("open");
  els.levelDropdown?.closest(".date-filter-group")?.classList.remove("active");
  els.typeDropdown?.closest(".date-filter-group")?.classList.remove("active");
  els.dateDropdown?.closest(".date-filter-group")?.classList.remove("active");
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

function setElText(el, text) {
  if (!el) return;
  el.textContent = text == null || text === "" ? "—" : String(text);
}

function normalizeTypeKey(raw) {
  return (raw || "").toString().trim();
}

function rebuildScholarshipTypeDropdown(apps) {
  const dropdown = els.typeDropdown;
  const selectedLabel = els.typeSelectedLabel;
  const hidden = els.typeFilter;
  if (!dropdown || !selectedLabel || !hidden) return;

  const menu = dropdown.querySelector(".dropdown-options");
  if (!menu) return;

  const current = normalizeTypeKey(hidden.value);

  const typeKeys = Array.from(
    new Set(
      (apps || [])
        .map((a) => normalizeTypeKey(a.scholarshipTypeRaw))
        .filter((v) => v !== ""),
    ),
  );

  typeKeys.sort((a, b) => {
    const la = formatScholarshipType(a).toLowerCase();
    const lb = formatScholarshipType(b).toLowerCase();
    return la.localeCompare(lb);
  });

  const allLabel = "All";
  const rows = [
    { value: "", label: allLabel },
    ...typeKeys.map((value) => ({
      value,
      label: formatScholarshipType(value),
    })),
  ];

  menu.innerHTML = rows
    .map(({ value, label }) => {
      const active = normalizeTypeKey(value) === current;
      return `<li data-value="${escapeHtml(value)}"${
        active ? ' class="active"' : ""
      }>${escapeHtml(label)}</li>`;
    })
    .join("");

  // If current filter no longer exists, fall back to "All"
  const hasCurrent =
    current === "" || typeKeys.some((k) => normalizeTypeKey(k) === current);
  if (!hasCurrent) {
    hidden.value = "";
    selectedLabel.textContent = allLabel;
    const first = menu.querySelector('li[data-value=""]');
    if (first) first.classList.add("active");
  } else {
    const activeLi = menu.querySelector("li.active");
    selectedLabel.textContent = activeLi
      ? activeLi.textContent.trim()
      : allLabel;
  }

  // Bind clicks (menu is rebuilt dynamically)
  menu.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", (e) => {
      e.stopPropagation();
      const value = normalizeTypeKey(li.getAttribute("data-value") || "");
      hidden.value = value;
      selectedLabel.textContent = li.textContent.trim();
      menu
        .querySelectorAll("li")
        .forEach((el) => el.classList.remove("active"));
      li.classList.add("active");
      closeAllDropdowns();
      currentPage = 1;
      applyFilters();
    });
  });
}

function openScholarModal(app) {
  if (!els.modal || !app) return;
  els.modal.classList.add("open");
  els.modal.setAttribute("aria-hidden", "false");

  setElText(els.modalName, app.name);
  setElText(els.modalEmail, app.email);

  if (els.modalStatusBadge) {
    els.modalStatusBadge.textContent = app.bucket || "—";
    els.modalStatusBadge.className =
      "applicant-info-status-badge " +
      (app.bucket === "Accepted"
        ? "status-approved"
        : app.bucket === "Declined"
          ? "status-declined"
          : "status-in-progress");
    els.modalStatusBadge.style.display = "inline-block";
  }

  if (els.modalTypeBadge) {
    els.modalTypeBadge.textContent = app.scholarshipTypeLabel || "—";
    els.modalTypeBadge.className =
      "applicant-info-program-badge scholarship-type-badge " +
      (isRenewalApplication(app.rawData) ? "renewal" : "new");
    els.modalTypeBadge.style.display = app.scholarshipTypeLabel
      ? "inline-block"
      : "none";
  }

  if (els.modalGrid) {
    const raw = app.rawData || {};
    const items = [
      ["Scholarship Type", app.scholarshipTypeLabel],
      ["Applied Date", app.appliedDateStr],
      ["Status", app.statusLabel],
      ["Contact Number", raw.contactNumber || raw.phone || raw.mobile || "—"],
      ["Address", raw.address || raw.fullAddress || "—"],
      ["School", raw.school || raw.schoolName || "—"],
      ["Year/Level", raw.yearLevel || raw.gradeLevel || raw.level || "—"],
    ];
    els.modalGrid.innerHTML = items
      .map(
        ([label, value]) => `
          <div class="applicant-info-detail-row">
            <div class="applicant-info-detail-label">${escapeHtml(label)}</div>
            <div class="applicant-info-detail-value">${escapeHtml(value == null || value === "" ? "—" : String(value))}</div>
          </div>
        `,
      )
      .join("");
  }

  if (els.modalContent) els.modalContent.style.display = "block";
}

function closeScholarModal() {
  if (!els.modal) return;
  els.modal.classList.remove("open");
  els.modal.setAttribute("aria-hidden", "true");
}

function renderTable(items) {
  if (!els.tableBody) return;
  if (els.totalCountFooter)
    els.totalCountFooter.textContent = String(allApplications.length);

  const totalFiltered = items.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = items.slice(start, start + PAGE_SIZE);

  if (els.filteredCount) els.filteredCount.textContent = String(totalFiltered);

  // Pagination UI
  if (els.paginationLabel)
    els.paginationLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  if (els.paginationPrev) {
    const prevDisabled = currentPage <= 1;
    els.paginationPrev.setAttribute("aria-disabled", String(prevDisabled));
  }
  if (els.paginationNext) {
    const nextDisabled = currentPage >= totalPages;
    els.paginationNext.setAttribute("aria-disabled", String(nextDisabled));
  }

  if (pageItems.length === 0) {
    els.tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center py-4 text-muted">
          No records found.
        </td>
      </tr>
    `;
    return;
  }

  els.tableBody.innerHTML = pageItems
    .map((app) => {
      return `
        <tr>
          <td style="text-align: left">
            <div class="fw-bold">${escapeHtml(app.name)}</div>
            <div class="small text-muted">${escapeHtml(app.email)}</div>
          </td>
          <td style="text-align: center">
            <span class="scholarship-type-badge ${isRenewalApplication(app.rawData) ? "renewal" : "new"}">${escapeHtml(app.scholarshipTypeLabel)}</span>
          </td>
          <td style="text-align: center">${escapeHtml(app.appliedDateStr)}</td>
          <td style="text-align: center">
            <span class="${statusBadgeClass(app.bucket)}">
              ${escapeHtml(app.statusLabel)}
            </span>
          </td>
          <td class="scholarship-actions" style="text-align: center">
            <div class="actions-cell-inner">
              <div class="actions-dropdown">
                <button
                  type="button"
                  class="btn btn-sm btn-actions-dropdown-toggle js-actions-dropdown-toggle"
                  data-id="${escapeHtml(app.id)}"
                  title="Actions"
                  aria-label="Actions"
                >
                  <i class="fas fa-ellipsis-v"></i>
                </button>
                <div class="actions-dropdown-menu">
                  <button type="button" class="actions-dropdown-item js-dropdown-view" data-id="${escapeHtml(app.id)}">
                    <i class="fas fa-eye"></i> View
                  </button>
                  <button type="button" class="actions-dropdown-item js-dropdown-accept" data-id="${escapeHtml(app.id)}">
                    <i class="fas fa-check"></i> Accept
                  </button>
                  <button type="button" class="actions-dropdown-item actions-dropdown-item-danger js-dropdown-decline" data-id="${escapeHtml(app.id)}">
                    <i class="fas fa-times"></i> Decline
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

function applyFilters() {
  const term = (els.searchBox?.value || "").trim().toLowerCase();
  const statusFilterVal = (els.statusFilter?.value || "").trim();
  const levelFilterVal = (els.levelFilter?.value || "").trim();
  const typeFilterVal = normalizeTypeKey(els.typeFilter?.value || "");
  const dateFilter = (els.dateFilter?.value || "all").trim();
  const dateFrom = els.dateFrom?.value || "";
  const dateTo = els.dateTo?.value || "";

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
  } else if (dateFilter === "custom") {
    if (dateFrom) startDate = new Date(dateFrom);
    if (dateTo) {
      endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
    }
  }

  const filtered = term
    ? allApplications.filter((a) => {
        const hay = [
          a.name,
          a.email,
          a.scholarshipTypeLabel,
          a.statusLabel,
          a.bucket,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(term);
      })
    : allApplications.slice();

  filtered.sort((x, y) => {
    const xt = x.appliedDateObj ? x.appliedDateObj.getTime() : -Infinity;
    const yt = y.appliedDateObj ? y.appliedDateObj.getTime() : -Infinity;
    return yt - xt;
  });

  const visible = filtered.filter((a) => {
    const matchesStatus =
      !statusFilterVal || (a.bucket || "Other") === statusFilterVal;

    const matchesTab =
      tabFilter === "all" ||
      (tabFilter === "new" && !isRenewalApplication(a.rawData)) ||
      (tabFilter === "renewal" && isRenewalApplication(a.rawData));

    const matchesLevel = !levelFilterVal || (a.level || "") === levelFilterVal;

    const matchesScholarshipType =
      !typeFilterVal ||
      normalizeTypeKey(a.scholarshipTypeRaw || "") === typeFilterVal;

    let matchesDate = true;
    if (dateFilter !== "all") {
      if (!a.appliedDateObj) return false;
      if (startDate && a.appliedDateObj < startDate) matchesDate = false;
      if (endDate && a.appliedDateObj > endDate) matchesDate = false;
    }

    return (
      matchesStatus &&
      matchesTab &&
      matchesLevel &&
      matchesScholarshipType &&
      matchesDate
    );
  });

  filteredApplications = visible;
  renderTable(filteredApplications);
}

async function ensureAdmin(user) {
  try {
    // Check users collection (legacy)
    const usersRef = doc(db, "users", user.uid);
    const usersSnap = await getDoc(usersRef);
    const usersRole = usersSnap.exists() ? usersSnap.data()?.role : null;
    if (usersRole === "admin") return true;

    // Check adminUsers collection (dashboard staff/admin accounts)
    const adminRef = doc(db, "adminUsers", user.uid);
    const adminSnap = await getDoc(adminRef);
    const adminData = adminSnap.exists() ? adminSnap.data() : null;
    const adminRole = adminData?.role;
    if (adminRole === "admin") return true;
    if (adminRole === "staff" && adminData?.isApproved === true) return true;

    return false;
  } catch {
    // If role lookup fails, still attempt fetch; Firestore rules will protect data.
    return true;
  }
}

async function fetchScholarshipApplications() {
  if (els.loading) LoadingOverlay.show(els.loading);
  clearError();
  allApplications = [];
  documentRefsByPath.clear();
  currentPage = 1;

  const tryTopLevel = async () => {
    const q = query(
      collection(db, "scholarshipapplied"),
      orderBy("createdAt", "desc"),
    );
    return await getDocs(q);
  };

  const tryCollectionGroup = async () => {
    const q = query(
      collectionGroup(db, "ScholarshipApplied"),
      orderBy("createdAt", "desc"),
    );
    return await getDocs(q);
  };

  let snap = null;
  try {
    snap = await tryTopLevel();
  } catch (e1) {
    // ignore, fallback below
    console.warn(
      "Top-level scholarshipapplied query failed, trying collectionGroup...",
      e1,
    );
  }

  if (!snap || snap.empty) {
    try {
      snap = await tryCollectionGroup();
    } catch (e2) {
      console.error("Failed to query scholarship applications:", e2);
      throw e2;
    }
  }

  if (snap) {
    snap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const name = getScholarName(data);
      const email = data.email || data.userEmail || "—";
      const scholarshipTypeRaw = getScholarshipTypeRaw(data);
      const scholarshipTypeLabel = formatScholarshipType(scholarshipTypeRaw);
      const { dateObj, dateStr } = getAppliedDate(data);
      const rawStatus =
        data.applicationStatus ||
        data.pesoStatus ||
        data.status ||
        data.scholarshipStatus ||
        "";
      const bucket = bucketFor(data);
      const statusLabel = rawStatus
        ? toTitleCase(String(rawStatus).replace(/_/g, " "))
        : bucket;

      const path = docSnap.ref?.path || "";
      const writable = path.startsWith("scholarshipapplied/");
      documentRefsByPath.set(path, docSnap.ref);

      const level = getLevelFromType(scholarshipTypeRaw || "");

      allApplications.push({
        id: docSnap.id,
        path,
        name,
        email,
        scholarshipTypeLabel,
        scholarshipTypeRaw: scholarshipTypeRaw || "",
        level,
        appliedDateObj: dateObj,
        appliedDateStr: dateStr,
        bucket,
        statusLabel,
        writable,
        rawData: data,
      });
    });
  }

  if (els.totalCountFooter)
    els.totalCountFooter.textContent = String(allApplications.length);

  if (els.results) els.results.style.display = "block";
  rebuildScholarshipTypeDropdown(allApplications);
  applyFilters();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/pages/login/login.html";
    return;
  }
  document.documentElement.classList.remove("auth-pending");

  const isAdmin = await ensureAdmin(user);
  if (!isAdmin) {
    if (els.loading) LoadingOverlay.hide(els.loading);
    showError(
      "Access denied. Admin account required to view scholarship applications.",
    );
    return;
  }

  try {
    await fetchScholarshipApplications();
  } catch (err) {
    const msg = err?.message || String(err);
    if (
      msg.toLowerCase().includes("permission") ||
      msg.toLowerCase().includes("missing or insufficient permissions")
    ) {
      showError(
        "Missing permissions to read scholarship applications. Make sure your account is an admin and Firestore rules allow admins to read ScholarshipApplied.",
      );
    } else {
      showError("Failed to load scholarship applications: " + msg);
    }
  } finally {
    if (els.loading) LoadingOverlay.hide(els.loading);
  }
});

if (els.searchBox) {
  els.searchBox.addEventListener("input", () => {
    currentPage = 1;
    applyFilters();
  });
}

// Status pills
if (els.statusPills) {
  els.statusPills
    .querySelectorAll(".scholarship-filter-cell")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const value = btn.getAttribute("data-value") || "";
        if (els.statusFilter) els.statusFilter.value = value;
        els.statusPills
          .querySelectorAll(".scholarship-filter-cell")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentPage = 1;
        applyFilters();
      });
    });
}

// Tabs (All / New / Renewal)
if (els.tabs) {
  els.tabs.querySelectorAll(".scholarship-filter-cell").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab") || "all";
      tabFilter = tab;
      els.tabs.querySelectorAll(".scholarship-filter-cell").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-tab") === tab);
        b.setAttribute(
          "aria-selected",
          b.getAttribute("data-tab") === tab ? "true" : "false",
        );
      });
      currentPage = 1;
      applyFilters();
    });
  });
}

// Level dropdown
setupDropdown(els.levelDropdown);
setupOptionsClick(
  els.levelDropdown?.querySelector(".dropdown-options"),
  (li) => {
    const value = li.getAttribute("data-value") || "";
    if (els.levelFilter) els.levelFilter.value = value;
    if (els.levelSelectedLabel)
      els.levelSelectedLabel.textContent = value
        ? li.textContent.trim()
        : "All levels";
    els.levelDropdown
      ?.querySelectorAll(".dropdown-options li")
      .forEach((el) => el.classList.remove("active"));
    li.classList.add("active");
    closeAllDropdowns();
    currentPage = 1;
    applyFilters();
  },
);

// Scholarship type dropdown (options are built dynamically after fetch)
setupDropdown(els.typeDropdown);

setupDropdown(els.dateDropdown);
setupOptionsClick(
  els.dateDropdown?.querySelector(".dropdown-options"),
  (li) => {
    const value = li.getAttribute("data-value") || "all";
    if (els.dateFilter) els.dateFilter.value = value;
    if (els.dateSelectedLabel)
      els.dateSelectedLabel.textContent = li.textContent;
    els.dateDropdown
      ?.querySelectorAll(".dropdown-options li")
      .forEach((el) => el.classList.remove("active"));
    li.classList.add("active");
    if (els.customDateInputs) {
      els.customDateInputs.classList.toggle("hidden", value !== "custom");
    }
    closeAllDropdowns();
    currentPage = 1;
    applyFilters();
  },
);

if (els.dateFrom) els.dateFrom.addEventListener("change", () => applyFilters());
if (els.dateTo) els.dateTo.addEventListener("change", () => applyFilters());

document.addEventListener("click", closeAllDropdowns);

// Pagination controls
if (els.paginationPrev) {
  els.paginationPrev.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable(filteredApplications);
    }
  });
}
if (els.paginationNext) {
  els.paginationNext.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil((filteredApplications?.length || 0) / PAGE_SIZE),
    );
    if (currentPage < totalPages) {
      currentPage++;
      renderTable(filteredApplications);
    }
  });
}

// Table actions: dropdown toggle + view/accept/decline
els.tableBody?.addEventListener("click", async (e) => {
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

  const viewBtn = e.target?.closest?.(".js-dropdown-view");
  if (viewBtn) {
    closeActionsDropdowns();
    const id = viewBtn.getAttribute("data-id");
    const app = allApplications.find((a) => a.id === id);
    if (app) openScholarModal(app);
    return;
  }

  const acceptBtn = e.target?.closest?.(".js-dropdown-accept");
  const declineBtn = e.target?.closest?.(".js-dropdown-decline");
  const actionBtn = acceptBtn || declineBtn;
  if (!actionBtn) return;
  const action = acceptBtn ? "accept" : "decline";
  const id = actionBtn.getAttribute("data-id");
  const app = allApplications.find((a) => a.id === id);
  if (!app) return;

  closeActionsDropdowns();

  if (!app.writable) {
    alert(
      "This record is read-only and cannot be updated from this table (it was loaded from a user subcollection).",
    );
    return;
  }

  const nextStatus = action === "accept" ? "Accepted" : "Declined";
  const ok = window.confirm(`Set this application to "${nextStatus}"?`);
  if (!ok) return;

  actionBtn.disabled = true;
  try {
    const ref = documentRefsByPath.get(app.path);
    if (!ref) throw new Error("Document reference not found.");
    const statusValue = nextStatus.toLowerCase();
    await updateDoc(ref, {
      applicationStatus: statusValue,
      status: statusValue,
      updatedAt: serverTimestamp(),
    });

    app.rawData = {
      ...(app.rawData || {}),
      applicationStatus: statusValue,
      status: statusValue,
    };
    app.bucket = bucketFor(app.rawData);
    app.statusLabel = toTitleCase(statusValue);

    applyFilters();
    if (typeof window.showToast === "function") {
      setTimeout(
        () =>
          window.showToast(
            nextStatus === "Accepted"
              ? "Scholar approved successfully."
              : "Scholar declined successfully.",
            "success",
          ),
        50,
      );
    }

    const scholarFirebaseUid = resolveApplicantFirebaseUid({
      raw: app.rawData,
      firestorePath: app.path,
    });

    if (nextStatus === "Accepted") {
      notifyApproval({
        applicantName: app.name,
        programName: app.scholarshipTypeLabel,
        type: "scholarship",
        raw: app.rawData,
        firestorePath: app.path,
        decision: statusValue,
        remarks: "",
      }).catch(() => {});
      await createApplicationDecisionNotification({
        userId: scholarFirebaseUid || null,
        path: app.path,
        status: statusValue,
        remarks: "",
        type: "scholarship",
      });
    } else {
      notifyDecline({
        applicantName: app.name,
        programName: app.scholarshipTypeLabel,
        type: "scholarship",
        raw: app.rawData,
        firestorePath: app.path,
        decision: statusValue,
        remarks: "",
      }).catch(() => {});
      await createApplicationDecisionNotification({
        userId: scholarFirebaseUid || null,
        path: app.path,
        status: statusValue,
        remarks: "",
        type: "scholarship",
      });
    }
  } catch (err) {
    console.error("Failed to update scholarship status:", err);
    alert("Failed to update status. " + (err?.message || String(err)));
  } finally {
    actionBtn.disabled = false;
  }
});

// Modal close handlers
document.querySelectorAll(".js-close-scholarship-modal").forEach((el) => {
  el.addEventListener("click", closeScholarModal);
});
els.modal?.addEventListener("click", (e) => {
  if (e.target === els.modal) closeScholarModal();
});
