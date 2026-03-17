/**
 * Dashboard: announcements carousel with arrows and slide animation.
 */
import { db } from "/js/config/firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ANNOUNCEMENTS_COLLECTION = "announcements";
const ITEM_WIDTH = 280;
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

function formatPosted(date) {
  if (!date) return "";
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

async function fetchAnnouncements(limitCount = 15) {
  if (!db) return [];
  const q = query(
    collection(db, ANNOUNCEMENTS_COLLECTION),
    orderBy("postedAt", "desc"),
    limit(limitCount),
  );
  const snapshot = await getDocs(q);
  const list = [];
  snapshot.forEach((docSnap) => {
    const d = docSnap.data();
    const postedAt =
      d.postedAt && d.postedAt.toDate ? d.postedAt.toDate() : null;
    list.push({
      id: docSnap.id,
      title: d.title || "",
      description: (d.description || "").slice(0, 120),
      category: d.category || "",
      postedAt,
      imageUrl: d.imageUrl || null,
    });
  });
  return list;
}

function getCategoryBorderClass(category) {
  const c = (category || "").toLowerCase().trim();
  if (c.includes("training")) return "dashboard-announcement--training";
  if (c.includes("peso") && c.includes("update"))
    return "dashboard-announcement--peso-update";
  if (c.includes("peso")) return "dashboard-announcement--peso-update";
  if (c.includes("tip") || c.includes("tips"))
    return "dashboard-announcement--tips";
  return "dashboard-announcement--other";
}

function renderItems(announcements) {
  return announcements
    .map((a) => {
      const hasImage = a.imageUrl && a.imageUrl.trim();
      const bgVar = hasImage
        ? `--announcement-bg-image: url(${escapeHtml(a.imageUrl)})`
        : "";
      const borderClass = getCategoryBorderClass(a.category);
      return `
    <a href="/pages/announcements/announcements.html" class="dashboard-carousel-item dashboard-announcement-item ${borderClass} ${hasImage ? "has-image" : ""}" style="${bgVar}">
      <div class="dashboard-announcement-overlay">
        <span class="dashboard-announcement-category">${escapeHtml(a.category) || "Announcement"}</span>
        <h4 class="dashboard-announcement-title">${escapeHtml(a.title)}</h4>
        <p class="dashboard-announcement-desc">${escapeHtml(a.description)}${(a.description || "").length >= 120 ? "…" : ""}</p>
        <span class="dashboard-announcement-date">${formatPosted(a.postedAt)}</span>
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
  const container = document.getElementById("dashboardAnnouncementsCarousel");
  if (!container) return;

  const announcements = await fetchAnnouncements(15);

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "dashboard-carousel-content";

  if (!announcements.length) {
    contentWrapper.innerHTML = `
      <div class="dashboard-empty-state">
        <span class="dashboard-empty-icon"><i class="fas fa-bullhorn"></i></span>
        <p class="dashboard-empty-text">No announcements yet</p>
        <a href="/pages/announcements/announcements.html" class="dashboard-empty-cta">Post your first announcement</a>
      </div>
    `;
  } else {
    const itemsHtml = renderItems(announcements);
    contentWrapper.innerHTML = `
      <button type="button" class="dashboard-carousel-prev" aria-label="Previous">
        <i class="fas fa-chevron-left"></i>
      </button>
      <div class="dashboard-carousel-viewport dashboard-carousel-viewport--three">
        <div class="dashboard-carousel-track" id="dashboardAnnouncementsTrack">
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

  if (announcements.length) {
    setupThreePerRowArrows(
      "dashboardAnnouncementsCarousel",
      "dashboardAnnouncementsTrack",
      announcements.length,
    );
  }
}
