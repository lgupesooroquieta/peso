/**
 * Dashboard: applicant counts only. Loads fast so numbers appear first.
 * Includes last-month counts for trend comparison.
 */
import { db } from "/js/config/firebase.js";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function getMonthBounds() {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { startThisMonth, startLastMonth };
}

async function fetchApplicantCounts() {
  let jobCount = 0;
  let scholarshipCount = 0;
  let jobThisMonth = 0;
  let jobLastMonth = 0;
  let scholarshipThisMonth = 0;
  let scholarshipLastMonth = 0;
  if (!db)
    return {
      total: 0,
      job: 0,
      scholarship: 0,
      jobThisMonth: 0,
      jobLastMonth: 0,
      scholarshipThisMonth: 0,
      scholarshipLastMonth: 0,
      announcementCount: 0,
    };

  const { startThisMonth, startLastMonth } = getMonthBounds();

  try {
    const jobQ = query(collectionGroup(db, "JobApplied"));
    const jobSnap = await getDocs(jobQ);
    jobCount = jobSnap.size;
    jobSnap.forEach((doc) => {
      const createdAt = doc.data().createdAt?.toDate?.() ?? null;
      if (createdAt) {
        if (createdAt >= startThisMonth) jobThisMonth++;
        else if (createdAt >= startLastMonth && createdAt < startThisMonth)
          jobLastMonth++;
      }
    });
  } catch (e) {
    console.warn("Job applicants count failed", e);
  }

  try {
    const scholQ = query(collection(db, "scholarshipapplied"));
    const scholSnap = await getDocs(scholQ);
    scholarshipCount = scholSnap.size;
    scholSnap.forEach((doc) => {
      const createdAt = doc.data().createdAt?.toDate?.() ?? null;
      if (createdAt) {
        if (createdAt >= startThisMonth) scholarshipThisMonth++;
        else if (createdAt >= startLastMonth && createdAt < startThisMonth)
          scholarshipLastMonth++;
      }
    });
  } catch (e1) {
    try {
      const scholQ = query(collectionGroup(db, "ScholarshipApplied"));
      const scholSnap = await getDocs(scholQ);
      scholarshipCount = scholSnap.size;
      scholSnap.forEach((doc) => {
        const createdAt = doc.data().createdAt?.toDate?.() ?? null;
        if (createdAt) {
          if (createdAt >= startThisMonth) scholarshipThisMonth++;
          else if (createdAt >= startLastMonth && createdAt < startThisMonth)
            scholarshipLastMonth++;
        }
      });
    } catch (e2) {
      console.warn("Scholarship applicants count failed", e2);
    }
  }

  let announcementCount = 0;
  try {
    const annQ = query(collection(db, "announcements"));
    const annSnap = await getDocs(annQ);
    announcementCount = annSnap.size;
  } catch (_) {}

  return {
    total: jobCount + scholarshipCount,
    job: jobCount,
    scholarship: scholarshipCount,
    jobThisMonth,
    jobLastMonth,
    scholarshipThisMonth,
    scholarshipLastMonth,
    announcementCount,
  };
}

function getTrendHtml(current, lastMonth, label = "vs last month") {
  if (lastMonth == null || lastMonth === undefined) return "";
  const delta = current - lastMonth;
  if (delta > 0)
    return `<span class="stat-trend stat-trend-up"><i class="fas fa-arrow-up"></i> ${delta} ${label}</span>`;
  if (delta < 0)
    return `<span class="stat-trend stat-trend-down"><i class="fas fa-arrow-down"></i> ${Math.abs(delta)} ${label}</span>`;
  return `<span class="stat-trend stat-trend-flat">— same ${label}</span>`;
}

function updateStatCards(counts) {
  const totalThisMonth =
    (counts.jobThisMonth ?? 0) + (counts.scholarshipThisMonth ?? 0);
  const totalLastMonth =
    (counts.jobLastMonth ?? 0) + (counts.scholarshipLastMonth ?? 0);

  const cards = [
    {
      count: counts.total,
      thisMonth: totalThisMonth,
      lastMonth: totalLastMonth,
      countId: "statTotalCount",
      trendId: "statTotalTrend",
      emptyId: "statEmptyTotal",
    },
    {
      count: counts.job,
      thisMonth: counts.jobThisMonth,
      lastMonth: counts.jobLastMonth,
      countId: "statJobCount",
      trendId: "statJobTrend",
      emptyId: "statEmptyJob",
    },
    {
      count: counts.scholarship,
      thisMonth: counts.scholarshipThisMonth,
      lastMonth: counts.scholarshipLastMonth,
      countId: "statScholarshipCount",
      trendId: "statScholarshipTrend",
      emptyId: "statEmptyScholarship",
    },
  ];

  cards.forEach(
    ({ count, thisMonth, lastMonth, countId, trendId, emptyId }) => {
      const countEl = document.getElementById(countId);
      const trendEl = document.getElementById(trendId);
      const emptyEl = document.getElementById(emptyId);
      const countArea = document
        .querySelector(`#${countId}`)
        ?.closest(".stat-count-area");
      const card = countEl?.closest(".stat-card");

      if (!card) return;

      if (count === 0) {
        card.classList.add("stat-card-empty");
        if (countArea) countArea.classList.add("d-none");
        if (emptyEl) emptyEl.classList.remove("stat-empty-hidden");
      } else {
        card.classList.remove("stat-card-empty");
        if (countArea) countArea.classList.remove("d-none");
        if (emptyEl) emptyEl.classList.add("stat-empty-hidden");
        if (countEl) countEl.textContent = count;
        if (trendEl)
          trendEl.innerHTML = getTrendHtml(thisMonth ?? count, lastMonth);
      }
      card.classList.add("stat-loaded");
    },
  );
}

function makeStatCardsClickable() {
  const base = "/pages";
  const cards = [
    { id: "statCardTotal", href: `${base}/job_applicants/job_applicants.html` },
    { id: "statCardJob", href: `${base}/job_applicants/job_applicants.html` },
    {
      id: "statCardScholarship",
      href: `${base}/scholarship_applied/scholarship_applied.html`,
    },
  ];
  cards.forEach(({ id, href }) => {
    const card = document.getElementById(id);
    if (!card || card.querySelector("a.stat-card-link")) return;
    if (card.classList.contains("stat-card-empty")) return;
    const link = document.createElement("a");
    link.href = href;
    link.className = "stat-card-link";
    link.setAttribute(
      "aria-label",
      `View ${id.replace("statCard", "")} applicants`,
    );
    const countArea = card.querySelector(".stat-count-area");
    const h6 = card.querySelector("h6");
    if (h6 && countArea) {
      link.appendChild(h6);
      link.appendChild(countArea);
      card.insertBefore(link, card.firstChild);
    }
  });
}

export async function init() {
  const counts = await fetchApplicantCounts();
  updateStatCards(counts);
  makeStatCardsClickable();
}
