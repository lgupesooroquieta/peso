/**
 * Dashboard: programs & scholarship programs carousel with arrows and slide animation.
 */
import { db } from "/js/config/firebase.js";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const JOB_PROGRAMS_COLLECTION = "jobPrograms";
const SCHOLARSHIP_PROGRAMS_COLLECTION = "scholarshipPrograms";
const ITEM_WIDTH = 260;
const GAP = 16;
const STEP = ITEM_WIDTH + GAP;
const ITEMS_PER_PAGE = 3;
const PAGE_STEP = ITEMS_PER_PAGE * STEP;

function escapeHtml(text) {
  if (text == null || text === "") return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getWeekStart(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

async function fetchJobProgramsWithCounts() {
  if (!db) return [];
  const programsQuery = query(
    collection(db, JOB_PROGRAMS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(20),
  );
  const programsSnap = await getDocs(programsQuery);
  const applicantsQuery = query(
    collectionGroup(db, "JobApplied"),
    orderBy("createdAt", "desc"),
  );
  const applicantsSnap = await getDocs(applicantsQuery);

  const weekStart = getWeekStart(new Date());
  const applicantsByProgram = {};
  const applicantsThisWeekByProgram = {};

  applicantsSnap.forEach((docSnap) => {
    const data = docSnap.data();
    const programKey =
      data.jobProgramName || data.programType || data.program || "Other";
    applicantsByProgram[programKey] =
      (applicantsByProgram[programKey] || 0) + 1;
    const createdAt =
      data.createdAt && data.createdAt.toDate ? data.createdAt.toDate() : null;
    if (createdAt && createdAt >= weekStart) {
      applicantsThisWeekByProgram[programKey] =
        (applicantsThisWeekByProgram[programKey] || 0) + 1;
    }
  });

  const list = [];
  programsSnap.forEach((docSnap) => {
    const d = docSnap.data();
    const programType = d.programType || "Program";
    list.push({
      id: docSnap.id,
      type: "job",
      name: programType,
      imageUrl: d.jobProgramImage || null,
      applicantCount: applicantsByProgram[programType] || 0,
      applicantsThisWeek: applicantsThisWeekByProgram[programType] || 0,
    });
  });
  return list;
}

async function fetchScholarshipProgramsWithCounts() {
  if (!db) return [];
  const programsQuery = query(
    collection(db, SCHOLARSHIP_PROGRAMS_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(20),
  );
  const programsSnap = await getDocs(programsQuery);

  let applicationsSnap = null;
  try {
    const q = query(
      collection(db, "scholarshipapplied"),
      orderBy("createdAt", "desc"),
    );
    applicationsSnap = await getDocs(q);
  } catch (e) {
    try {
      const q = query(
        collectionGroup(db, "ScholarshipApplied"),
        orderBy("createdAt", "desc"),
      );
      applicationsSnap = await getDocs(q);
    } catch (e2) {
      console.warn("Could not fetch scholarship applications for counts", e2);
    }
  }

  const weekStart = getWeekStart(new Date());
  const applicantsByProgram = {};
  const applicantsThisWeekByProgram = {};

  if (applicationsSnap) {
    applicationsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const programKey =
        data.scholarshipType ||
        data.scholarshipPeriodId ||
        data.program ||
        data.type ||
        "Other";
      const key = String(programKey).trim() || "Other";
      applicantsByProgram[key] = (applicantsByProgram[key] || 0) + 1;
      const createdAt =
        data.createdAt && data.createdAt.toDate
          ? data.createdAt.toDate()
          : null;
      if (createdAt && createdAt >= weekStart) {
        applicantsThisWeekByProgram[key] =
          (applicantsThisWeekByProgram[key] || 0) + 1;
      }
    });
  }

  const list = [];
  programsSnap.forEach((docSnap) => {
    const d = docSnap.data();
    const programType = d.type || d.name || "Scholarship";
    list.push({
      id: docSnap.id,
      type: "scholarship",
      name: d.name || programType,
      imageUrl: d.imageUrl || d.image || d.photo || null,
      applicantCount:
        applicantsByProgram[programType] || applicantsByProgram[d.name] || 0,
      applicantsThisWeek:
        applicantsThisWeekByProgram[programType] ||
        applicantsThisWeekByProgram[d.name] ||
        0,
    });
  });
  return list;
}

function renderItems(programs) {
  return programs
    .map((p) => {
      const hasImage = p.imageUrl && p.imageUrl.trim();
      const bgVar = hasImage
        ? `--program-bg-image: url(${escapeHtml(p.imageUrl)})`
        : "";
      const link =
        p.type === "job"
          ? "/pages/programs/programs.html"
          : "/pages/scholarship_programs/scholarship_programs.html";
      return `
    <a href="${link}" class="dashboard-carousel-item dashboard-program-item ${hasImage ? "has-image" : ""}" style="${bgVar}">
      <div class="dashboard-program-overlay">
        <h4 class="dashboard-program-name">${escapeHtml(p.name)}</h4>
        <span class="dashboard-program-type-badge">${p.type === "job" ? "Job Program" : "Scholarship"}</span>
        <div class="dashboard-program-stats">
          <span><i class="fas fa-users"></i> ${p.applicantCount} total</span>
          <span><i class="fas fa-user-plus"></i> ${p.applicantsThisWeek} this week</span>
        </div>
      </div>
    </a>
  `;
    })
    .join("");
}

function setupThreePerRowArrows(outerId, trackId, itemCount) {
  const outer = document.getElementById(outerId);
  const track = document.getElementById(trackId);
  if (!outer || !track || itemCount === 0) return;

  const prevBtn = outer.querySelector(".dashboard-carousel-prev");
  const nextBtn = outer.querySelector(".dashboard-carousel-next");

  track.style.width = "max-content";

  const totalPages = Math.ceil(itemCount / ITEMS_PER_PAGE);
  let page = 0;

  function applySlide() {
    const offset = -page * PAGE_STEP;
    track.style.transform = `translateX(${offset}px)`;
    if (prevBtn)
      prevBtn.setAttribute("aria-disabled", page <= 0 ? "true" : "false");
    if (nextBtn)
      nextBtn.setAttribute(
        "aria-disabled",
        page >= totalPages - 1 ? "true" : "false",
      );
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (page > 0) {
        page--;
        applySlide();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (page < totalPages - 1) {
        page++;
        applySlide();
      }
    });
  }

  applySlide();
}

export async function init() {
  const container = document.getElementById("dashboardProgramsCarousel");
  if (!container) return;

  const [jobPrograms, scholarshipPrograms] = await Promise.all([
    fetchJobProgramsWithCounts(),
    fetchScholarshipProgramsWithCounts(),
  ]);
  const allPrograms = [...jobPrograms, ...scholarshipPrograms];

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "dashboard-carousel-content";

  if (!allPrograms.length) {
    contentWrapper.innerHTML = `
      <div class="dashboard-empty-state">
        <span class="dashboard-empty-icon"><i class="fas fa-clipboard-list"></i></span>
        <p class="dashboard-empty-text">No programs posted yet</p>
        <a href="/pages/programs/programs.html" class="dashboard-empty-cta">Add your first program</a>
      </div>
    `;
  } else {
    const itemsHtml = renderItems(allPrograms);
    contentWrapper.innerHTML = `
      <button type="button" class="dashboard-carousel-prev" aria-label="Previous">
        <i class="fas fa-chevron-left"></i>
      </button>
      <div class="dashboard-carousel-viewport dashboard-carousel-viewport--three dashboard-carousel-viewport--programs">
        <div class="dashboard-carousel-track" id="dashboardProgramsTrack">
          ${itemsHtml}
        </div>
      </div>
      <button type="button" class="dashboard-carousel-next" aria-label="Next">
        <i class="fas fa-chevron-right"></i>
      </button>
    `;
  }

  container.appendChild(contentWrapper);
  container.classList.add("carousel-loaded");
  container.classList.remove("dashboard-carousel-loading");

  if (allPrograms.length) {
    setupThreePerRowArrows(
      "dashboardProgramsCarousel",
      "dashboardProgramsTrack",
      allPrograms.length,
    );
  }
}
