// Global defaults for better resolution
Chart.defaults.font.family = "'Segoe UI', 'Helvetica', 'Arial', sans-serif";

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
    ticks: isDark ? "#ffffff" : "#64748b",
    text: isDark ? "#ffffff" : "#334155",
    lineBorder: isDark ? "#93c5fd" : "#3b82f6",
    lineFillStart: isDark
      ? "rgba(147, 197, 253, 0.35)"
      : "rgba(59, 130, 246, 0.3)",
    lineFillEnd: isDark ? "rgba(147, 197, 253, 0)" : "rgba(59, 130, 246, 0)",
    linePointBg: isDark ? "#121a2f" : "#ffffff",
    linePointBorder: isDark ? "#93c5fd" : "#3b82f6",
    bar1: isDark ? "#60a5fa" : "#556ee6",
    bar2: isDark ? "#34d399" : "#34c38f",
    pieColors: isDark
      ? ["#34d399", "#f87171", "#fbbf24"]
      : ["#34c38f", "#f46a6a", "#f1b44c"],
    pieBorder: isDark ? "#1e293b" : "#ffffff",
    tooltipBg: isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.98)",
  };
}

let lineChartInstance, pieChartInstance, barChartInstance;

function buildLineChart(ctx, colors) {
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [
        {
          label: "Applicants",
          data: [12, 19, 15, 25, 22, 30],
          borderColor: colors.lineBorder,
          backgroundColor: (context) => {
            const chartCtx = context.chart.ctx;
            const gradient = chartCtx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, colors.lineFillStart);
            gradient.addColorStop(1, colors.lineFillEnd);
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: colors.linePointBg,
          pointBorderColor: colors.linePointBorder,
          pointBorderWidth: 2,
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
          grid: { color: colors.grid, borderDash: [5, 5] },
          ticks: { color: colors.ticks },
        },
        x: {
          grid: { display: false },
          ticks: { color: colors.ticks },
        },
      },
      animation: {
        y: { duration: 2000, easing: "easeOutQuart" },
        delay: (context) => {
          let delay = 0;
          if (context.type === "data" && context.mode === "default") {
            delay = context.dataIndex * 300;
          }
          return delay;
        },
      },
    },
  });
}

function buildPieChart(ctx, colors) {
  return new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Accepted", "Rejected", "Pending"],
      datasets: [
        {
          data: [45, 25, 30],
          backgroundColor: colors.pieColors,
          borderWidth: 2,
          borderColor: colors.pieBorder,
          hoverOffset: 15,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 20 },
      plugins: {
        legend: { labels: { color: colors.text } },
        tooltip: {
          titleColor: colors.text,
          bodyColor: colors.text,
          backgroundColor: colors.tooltipBg,
        },
      },
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1200,
        easing: "easeInOutCirc",
      },
    },
  });
}

function buildBarChart(ctx, colors) {
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [
        {
          label: "Job Openings",
          data: [45, 52, 38, 65, 48, 70],
          backgroundColor: colors.bar1,
          borderRadius: 5,
          barPercentage: 0.6,
        },
        {
          label: "Total Hired",
          data: [20, 35, 25, 40, 30, 45],
          backgroundColor: colors.bar2,
          borderRadius: 5,
          barPercentage: 0.6,
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
          grid: { color: colors.grid, borderDash: [2, 2] },
          ticks: { color: colors.ticks },
        },
        x: {
          grid: { display: false },
          ticks: { color: colors.ticks },
        },
      },
      animations: {
        y: { duration: 1500, easing: "easeOutCubic" },
      },
    },
  });
}

function initDashboardCharts() {
  const lineEl = document.getElementById("lineChart");
  const pieEl = document.getElementById("pieChart");
  const barEl = document.getElementById("barChart");
  if (!lineEl || !pieEl || !barEl) return;

  const theme = getDashboardTheme();
  const colors = getChartColors(theme);

  if (lineChartInstance) lineChartInstance.destroy();
  if (pieChartInstance) pieChartInstance.destroy();
  if (barChartInstance) barChartInstance.destroy();

  lineChartInstance = buildLineChart(lineEl.getContext("2d"), colors);
  pieChartInstance = buildPieChart(pieEl.getContext("2d"), colors);
  barChartInstance = buildBarChart(barEl.getContext("2d"), colors);

  lineEl.closest(".chart-container")?.classList.add("chart-loaded");
  pieEl.closest(".chart-container")?.classList.add("chart-loaded");
  barEl.closest(".chart-container")?.classList.add("chart-loaded");
}

function updateDashboardChartsTheme() {
  const theme = getDashboardTheme();
  const colors = getChartColors(theme);

  if (lineChartInstance) {
    lineChartInstance.data.datasets[0].borderColor = colors.lineBorder;
    lineChartInstance.data.datasets[0].backgroundColor = (context) => {
      const chartCtx = context.chart.ctx;
      const gradient = chartCtx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, colors.lineFillStart);
      gradient.addColorStop(1, colors.lineFillEnd);
      return gradient;
    };
    lineChartInstance.data.datasets[0].pointBackgroundColor =
      colors.linePointBg;
    lineChartInstance.data.datasets[0].pointBorderColor =
      colors.linePointBorder;
    lineChartInstance.options.scales.y.grid.color = colors.grid;
    lineChartInstance.options.scales.y.ticks.color = colors.ticks;
    lineChartInstance.options.scales.x.ticks.color = colors.ticks;
    lineChartInstance.options.plugins.legend.labels.color = colors.text;
    lineChartInstance.options.plugins.tooltip.titleColor = colors.text;
    lineChartInstance.options.plugins.tooltip.bodyColor = colors.text;
    lineChartInstance.options.plugins.tooltip.backgroundColor =
      colors.tooltipBg;
    lineChartInstance.update("none");
  }

  if (pieChartInstance) {
    pieChartInstance.data.datasets[0].backgroundColor = colors.pieColors;
    pieChartInstance.data.datasets[0].borderColor = colors.pieBorder;
    pieChartInstance.options.plugins.legend.labels.color = colors.text;
    pieChartInstance.options.plugins.tooltip.titleColor = colors.text;
    pieChartInstance.options.plugins.tooltip.bodyColor = colors.text;
    pieChartInstance.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
    pieChartInstance.update("none");
  }

  if (barChartInstance) {
    barChartInstance.data.datasets[0].backgroundColor = colors.bar1;
    barChartInstance.data.datasets[1].backgroundColor = colors.bar2;
    barChartInstance.options.scales.y.grid.color = colors.grid;
    barChartInstance.options.scales.y.ticks.color = colors.ticks;
    barChartInstance.options.scales.x.ticks.color = colors.ticks;
    barChartInstance.options.plugins.legend.labels.color = colors.text;
    barChartInstance.options.plugins.tooltip.titleColor = colors.text;
    barChartInstance.options.plugins.tooltip.bodyColor = colors.text;
    barChartInstance.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
    barChartInstance.update("none");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboardCharts);
} else {
  initDashboardCharts();
}

window.addEventListener("theme-changed", updateDashboardChartsTheme);
