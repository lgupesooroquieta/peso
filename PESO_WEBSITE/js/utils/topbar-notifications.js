import { db } from "/js/config/firebase.js";
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const STORAGE_KEY = "peso_admin_notifications_seen_at_v1";
const MAX_ITEMS = 30;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTimeAgo(date) {
  if (!date) return "Unknown date";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60000) return "Just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

function getSeenAt() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const asNum = Number(raw || 0);
  return Number.isFinite(asNum) ? asNum : 0;
}

function setSeenAt(ms) {
  window.localStorage.setItem(STORAGE_KEY, String(ms || 0));
}

function getApplicantName(data = {}) {
  const parts = [
    data.firstName,
    data.middleName,
    data.surname,
    data.lastName,
    data.suffix,
  ].filter((p) => p && String(p).trim() && String(p).toLowerCase() !== "none");
  return parts.join(" ") || data.fullName || data.name || "Applicant";
}

function getJobProgramType(data = {}) {
  return (
    data.programType ||
    data.jobProgramName ||
    data.jobProgram ||
    data.serviceApplied ||
    data.jobServiceApplied ||
    "Other"
  );
}

function getScholarshipType(data = {}) {
  return (
    data.scholarshipType ||
    data.scholarshipPeriodId ||
    data.periodId ||
    data.applicationType ||
    data.type ||
    data.program ||
    "Scholarship"
  );
}

function getCreatedAt(data = {}) {
  return (
    toDate(data.createdAt) ||
    toDate(data.submittedAt) ||
    toDate(data.appliedAt) ||
    toDate(data.timestamp) ||
    toDate(data.updatedAt) ||
    null
  );
}

async function fetchJobApplicants() {
  if (!db) return [];
  const q = query(
    collectionGroup(db, "JobApplied"),
    orderBy("createdAt", "desc"),
    limit(MAX_ITEMS),
  );
  const snap = await getDocs(q);
  const items = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    items.push({
      id: docSnap.id,
      path: docSnap.ref?.path || "",
      kind: "job",
      name: getApplicantName(data),
      programType: String(getJobProgramType(data)).trim() || "Other",
      createdAt: getCreatedAt(data),
    });
  });
  return items;
}

async function fetchScholarshipApplicants() {
  if (!db) return [];
  const topLevelQuery = query(
    collection(db, "scholarshipapplied"),
    orderBy("createdAt", "desc"),
    limit(MAX_ITEMS),
  );
  const groupQuery = query(
    collectionGroup(db, "ScholarshipApplied"),
    orderBy("createdAt", "desc"),
    limit(MAX_ITEMS),
  );

  let snap = null;
  try {
    snap = await getDocs(topLevelQuery);
  } catch (_) {
    // Fallback below.
  }
  if (!snap || snap.empty) {
    try {
      snap = await getDocs(groupQuery);
    } catch (_) {
      return [];
    }
  }

  const items = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    items.push({
      id: docSnap.id,
      path: docSnap.ref?.path || "",
      kind: "scholarship",
      name: getApplicantName(data),
      programType: String(getScholarshipType(data)).trim() || "Scholarship",
      createdAt: getCreatedAt(data),
    });
  });
  return items;
}

function buildProgramSummary(items) {
  const counts = new Map();
  items.forEach((item) => {
    const key = `${item.kind}|${item.programType}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([key, count]) => {
      const [kind, type] = key.split("|");
      return { kind, type, count };
    })
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

function ensureTopbarBell() {
  const icon = document.querySelector(".top-bar .fa-bell");
  if (!icon) return null;

  const wrapper = document.createElement("button");
  wrapper.type = "button";
  wrapper.className = "topbar-notif-btn";
  wrapper.setAttribute("aria-label", "Show notifications");
  wrapper.setAttribute("aria-expanded", "false");

  icon.classList.remove("me-3");
  icon.classList.add("topbar-notif-icon");

  const badge = document.createElement("span");
  badge.className = "topbar-notif-badge";
  badge.textContent = "0";

  icon.replaceWith(wrapper);
  wrapper.appendChild(icon);
  wrapper.appendChild(badge);

  const panel = document.createElement("div");
  panel.className = "topbar-notif-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="topbar-notif-panel-header">
      <h6>Notifications</h6>
      <button type="button" class="topbar-notif-close" aria-label="Close notifications">&times;</button>
    </div>
    <div class="topbar-notif-content">
      <div class="topbar-notif-loading">Loading notifications...</div>
    </div>
  `;
  document.body.appendChild(panel);

  return { wrapper, badge, panel };
}

function positionPanel(wrapper, panel) {
  const rect = wrapper.getBoundingClientRect();
  const panelWidth = 360;
  const margin = 12;
  const top = rect.bottom + 10;
  const right = Math.max(margin, window.innerWidth - rect.right - 4);
  panel.style.top = `${top}px`;
  panel.style.right = `${right}px`;
  panel.style.left = "auto";
  panel.style.maxWidth = `min(${panelWidth}px, calc(100vw - ${margin * 2}px))`;
}

function renderPanelContent(panel, allItems, unreadItems) {
  const content = panel.querySelector(".topbar-notif-content");
  if (!content) return;

  if (!allItems.length) {
    content.innerHTML = `<div class="topbar-notif-empty">No applicant notifications yet.</div>`;
    return;
  }

  const summary = buildProgramSummary(unreadItems).slice(0, 6);
  const summaryHtml = summary.length
    ? summary
        .map(
          (s) =>
            `<li><span>${escapeHtml(s.type)}</span><strong>${s.count}</strong></li>`,
        )
        .join("")
    : `<li><span>No new applicants</span><strong>0</strong></li>`;

  const listHtml = allItems
    .slice(0, 12)
    .map((item) => {
      const isUnread = unreadItems.some((u) => u.path === item.path);
      const kindLabel = item.kind === "job" ? "Job" : "Scholarship";
      return `
        <li class="topbar-notif-item ${isUnread ? "is-unread" : ""}">
          <div class="topbar-notif-item-row">
            <span class="topbar-notif-kind">${kindLabel}</span>
            <time>${formatTimeAgo(item.createdAt)}</time>
          </div>
          <div class="topbar-notif-title">${escapeHtml(item.name)}</div>
          <div class="topbar-notif-sub">New applicant for <strong>${escapeHtml(item.programType)}</strong></div>
        </li>
      `;
    })
    .join("");

  content.innerHTML = `
    <div class="topbar-notif-summary">
      <div class="topbar-notif-summary-label">New by program/scholarship</div>
      <ul>${summaryHtml}</ul>
    </div>
    <ul class="topbar-notif-list">${listHtml}</ul>
  `;
}

async function fetchAllApplicantNotifications() {
  const [jobs, scholarships] = await Promise.all([
    fetchJobApplicants(),
    fetchScholarshipApplicants(),
  ]);
  return [...jobs, ...scholarships]
    .filter((item) => item.createdAt instanceof Date)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function markAsSeen(items) {
  const latest = items[0]?.createdAt?.getTime?.() || 0;
  if (latest > 0) setSeenAt(latest);
}

export async function initTopbarNotifications() {
  const ui = ensureTopbarBell();
  if (!ui) return;

  const { wrapper, badge, panel } = ui;
  let allItems = [];
  let unreadItems = [];

  const refresh = async () => {
    try {
      allItems = await fetchAllApplicantNotifications();
      const seenAt = getSeenAt();
      unreadItems = allItems.filter(
        (item) => item.createdAt.getTime() > seenAt,
      );

      const count = unreadItems.length;
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.toggle("is-visible", count > 0);
      renderPanelContent(panel, allItems, unreadItems);
    } catch (err) {
      const content = panel.querySelector(".topbar-notif-content");
      if (content) {
        content.innerHTML =
          '<div class="topbar-notif-empty">Unable to load notifications.</div>';
      }
      console.warn("Notifications load failed:", err);
    }
  };

  const openPanel = () => {
    positionPanel(wrapper, panel);
    panel.hidden = false;
    wrapper.setAttribute("aria-expanded", "true");
  };

  const closePanel = () => {
    panel.hidden = true;
    wrapper.setAttribute("aria-expanded", "false");
  };

  wrapper.addEventListener("click", async (e) => {
    e.stopPropagation();
    const isOpen = !panel.hidden;
    if (isOpen) {
      closePanel();
      return;
    }
    openPanel();
    if (unreadItems.length) {
      markAsSeen(allItems);
      await refresh();
    }
  });

  panel.querySelector(".topbar-notif-close")?.addEventListener("click", () => {
    closePanel();
  });

  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    if (!panel.contains(e.target) && !wrapper.contains(e.target)) closePanel();
  });

  window.addEventListener("resize", () => {
    if (!panel.hidden) positionPanel(wrapper, panel);
  });

  await refresh();
  window.setInterval(refresh, 60000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initTopbarNotifications();
  });
} else {
  initTopbarNotifications();
}
