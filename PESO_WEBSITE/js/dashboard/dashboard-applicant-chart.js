/**
 * Dashboard: applicant chart (weekly/monthly) between stat cards and announcements.
 */
import { db } from "/js/config/firebase.js";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function getDashboardTheme() {
  try {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  } catch (_) {
    return "light";
  }
}

function getChartColors(theme) {
  const isDark = theme === "dark";
  return {
    grid: isDark ? "rgba(148, 163, 184, 0.2)" : "rgba(15, 23, 42, 0.08)",
    ticks: isDark ? "#94a3b8" : "#64748b",
    text: isDark ? "#f1f5f9" : "#334155",
    bar1: isDark ? "#60a5fa" : "#556ee6",
    bar2: isDark ? "#34d399" : "#34c38f",
    tooltipBg: isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.98)",
  };
}

function getWeekLabels(count = 4) {
  const labels = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    const start = new Date(d);
    start.setDate(
      start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1),
    );
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (x) =>
      x.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    labels.push(`${fmt(start)} – ${fmt(end)}`);
  }
  return labels;
}

function getWeekBuckets(count = 4) {
  const buckets = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7 * i);
    const start = new Date(d);
    start.setDate(
      start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1),
    );
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    buckets.push({ start, end });
  }
  return buckets;
}

async function fetchApplicantData() {
  const job = [];
  const scholarship = [];
  const buckets = getWeekBuckets(4);

  if (!db) return { job, scholarship };

  try {
    const jobQ = query(collectionGroup(db, "JobApplied"));
    const jobSnap = await getDocs(jobQ);
    jobSnap.forEach((doc) => {
      const createdAt = doc.data().createdAt?.toDate?.() ?? null;
      if (createdAt) {
        const idx = buckets.findIndex(
          (b) => createdAt >= b.start && createdAt < b.end,
        );
        if (idx >= 0) job[idx] = (job[idx] || 0) + 1;
      }
    });
  } catch (e) {
    console.warn("Applicant chart: job data failed", e);
  }

  try {
    const scholQ = query(collection(db, "scholarshipapplied"));
    const scholSnap = await getDocs(scholQ);
    scholSnap.forEach((doc) => {
      const createdAt = doc.data().createdAt?.toDate?.() ?? null;
      if (createdAt) {
        const idx = buckets.findIndex(
          (b) => createdAt >= b.start && createdAt < b.end,
        );
        if (idx >= 0) scholarship[idx] = (scholarship[idx] || 0) + 1;
      }
    });
  } catch (e1) {
    try {
      const scholQ = query(collectionGroup(db, "ScholarshipApplied"));
      const scholSnap = await getDocs(scholQ);
      scholSnap.forEach((doc) => {
        const createdAt = doc.data().createdAt?.toDate?.() ?? null;
        if (createdAt) {
          const idx = buckets.findIndex(
            (b) => createdAt >= b.start && createdAt < b.end,
          );
          if (idx >= 0) scholarship[idx] = (scholarship[idx] || 0) + 1;
        }
      });
    } catch (e2) {
      console.warn("Applicant chart: scholarship data failed", e2);
    }
  }

  const labels = getWeekLabels(4);
  const jobData = buckets.map((_, i) => job[i] || 0);
  const scholarshipData = buckets.map((_, i) => scholarship[i] || 0);
  return { labels, jobData, scholarshipData };
}

let applicantChartInstance = null;

export async function init() {
  const canvas = document.getElementById("applicantChart");
  if (!canvas) return;
  const ChartLib =
    typeof Chart !== "undefined"
      ? Chart
      : typeof window !== "undefined"
        ? window.Chart
        : null;
  if (!ChartLib) return;

  const { labels, jobData, scholarshipData } = await fetchApplicantData();
  const theme = getDashboardTheme();
  const colors = getChartColors(theme);

  if (applicantChartInstance) applicantChartInstance.destroy();

  const ChartLib = typeof Chart !== "undefined" ? Chart : window.Chart;
  if (!ChartLib) return;

  applicantChartInstance = new ChartLib(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Job Applicants",
          data: jobData,
          backgroundColor: colors.bar1,
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
        {
          label: "Scholarship Applicants",
          data: scholarshipData,
          backgroundColor: colors.bar2,
          borderRadius: 6,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: colors.text } },
        tooltip: {
          titleColor: colors.text,
          bodyColor: colors.text,
          backgroundColor: colors.tooltipBg,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: colors.grid },
          ticks: { color: colors.ticks, stepSize: 1 },
        },
        x: {
          grid: { display: false },
          ticks: { color: colors.ticks, maxRotation: 25 },
        },
      },
    },
  });
}
