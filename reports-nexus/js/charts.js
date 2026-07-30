/** Charts for Nexus report PDF output: stacked timelines + platform donut. */

import {
  STANCE_ORDER,
  STANCE_COLORS,
  STANCE_LABELS,
  PLATFORM_ORDER,
  PLATFORM_LABELS,
  PLATFORM_COLORS,
} from "./constants.js?v=2026-07-30-e20jp";

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDayLabel(isoDay) {
  const [y, m, d] = isoDay.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function enumerateDays(startIso, endIso) {
  const days = [];
  let t = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(t) || !Number.isFinite(end) || t > end) return days;
  while (t <= end) {
    days.push(new Date(t).toISOString().slice(0, 10));
    t += DAY_MS;
  }
  return days;
}

/**
 * Prefer continuous daily axis; fall back to active days when span is sparse.
 * Optional startDay/endDay clamps the chart window (e.g. 1 Jul → today).
 * Totals elsewhere can still include posts outside this window.
 * @param {{ series: Record<string, Record<string, number>>, minDay: string|null, maxDay: string|null }} bucket
 * @param {{ startDay?: string|null, endDay?: string|null }} [window]
 */
export function daysForSeriesBucket(bucket, window = {}) {
  const { startDay = null, endDay = null } = window;
  if (!bucket.minDay || !bucket.maxDay) return [];

  // No overlap with requested window → no chart
  if (startDay && bucket.maxDay < startDay) return [];
  if (endDay && bucket.minDay > endDay) return [];

  const axisMin = startDay || bucket.minDay;
  const axisMax = endDay || bucket.maxDay;
  if (axisMin > axisMax) return [];

  const active = new Set();
  for (const key of STANCE_ORDER) {
    for (const day of Object.keys(bucket.series[key] || {})) {
      if (day < axisMin || day > axisMax) continue;
      active.add(day);
    }
  }
  const activeDays = [...active].sort();

  const continuous = enumerateDays(axisMin, axisMax);
  if (!activeDays.length) return continuous;
  if (continuous.length > 45 && continuous.length > activeDays.length * 2) {
    return activeDays;
  }
  return continuous;
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   days: string[],
 *   series: Record<string, Record<string, number>>,
 *   height?: number,
 * }} opts
 */
export function renderStackedTimeline(container, opts) {
  const { days, series } = opts;
  if (!days.length) {
    container.innerHTML = `<p class="muted">No dated posts.</p>`;
    return;
  }

  const height = opts.height ?? 168;
  const width = Math.max(520, days.length * 28 + 56);
  const margin = { top: 10, right: 8, bottom: 36, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  let maxY = 0;
  for (const day of days) {
    let total = 0;
    for (const key of STANCE_ORDER) {
      total += series[key]?.[day] || 0;
    }
    if (total > maxY) maxY = total;
  }
  maxY = Math.max(1, maxY);

  const barGap = days.length > 40 ? 1 : 2;
  const barW = Math.max(4, innerW / days.length - barGap);
  const labelStep =
    days.length <= 16 ? 1 : days.length <= 32 ? 2 : Math.ceil(days.length / 12);

  const yTicks = niceTicks(maxY, 3);
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Posts by day with sentiment segments");
  svg.classList.add("timeline-chart");

  const g = document.createElementNS(svgNS, "g");
  g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
  svg.appendChild(g);

  for (const tick of yTicks) {
    const y = innerH - (tick / maxY) * innerH;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", "0");
    line.setAttribute("x2", String(innerW));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    line.setAttribute("class", "chart-grid");
    g.appendChild(line);

    const label = document.createElementNS(svgNS, "text");
    label.setAttribute("x", "-6");
    label.setAttribute("y", String(y + 3));
    label.setAttribute("text-anchor", "end");
    label.setAttribute("class", "chart-axis");
    label.textContent = String(tick);
    g.appendChild(label);
  }

  days.forEach((day, i) => {
    const x = (i / days.length) * innerW + barGap / 2;
    let yBase = innerH;
    for (const key of STANCE_ORDER) {
      const count = series[key]?.[day] || 0;
      if (!count) continue;
      const h = (count / maxY) * innerH;
      const rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", String(x));
      rect.setAttribute("y", String(yBase - h));
      rect.setAttribute("width", String(barW));
      rect.setAttribute("height", String(Math.max(0.5, h)));
      rect.setAttribute("fill", STANCE_COLORS[key]);
      rect.setAttribute("class", "chart-seg");
      g.appendChild(rect);
      yBase -= h;
    }

    if (i % labelStep === 0 || i === days.length - 1) {
      const tx = document.createElementNS(svgNS, "text");
      tx.setAttribute("x", String(x + barW / 2));
      tx.setAttribute("y", String(innerH + 14));
      tx.setAttribute("text-anchor", "middle");
      tx.setAttribute("class", "chart-axis chart-axis-x");
      tx.textContent = formatDayLabel(day);
      g.appendChild(tx);
    }
  });

  const base = document.createElementNS(svgNS, "line");
  base.setAttribute("x1", "0");
  base.setAttribute("x2", String(innerW));
  base.setAttribute("y1", String(innerH));
  base.setAttribute("y2", String(innerH));
  base.setAttribute("class", "chart-baseline");
  g.appendChild(base);

  container.replaceChildren(svg);
}

/**
 * @param {HTMLElement} container
 * @param {{ counts: Record<string, number>, total: number }} opts
 */
export function renderPlatformDonut(container, opts) {
  const { counts, total } = opts;
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const innerR = 48;
  const svgNS = "http://www.w3.org/2000/svg";

  const entries = PLATFORM_ORDER.map((key) => ({
    key,
    count: counts[key] || 0,
  })).filter((e) => e.count > 0);

  // Include any unknown platforms at the end
  for (const [key, count] of Object.entries(counts)) {
    if (PLATFORM_ORDER.includes(key) || !count) continue;
    entries.push({ key, count });
  }

  const wrap = document.createElement("div");
  wrap.className = "donut-wrap";

  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Platform distribution");
  svg.classList.add("donut-chart");

  if (!total || !entries.length) {
    wrap.innerHTML = `<p class="muted">No platform data.</p>`;
    container.replaceChildren(wrap);
    return;
  }

  let angle = -Math.PI / 2;
  for (const entry of entries) {
    const slice = (entry.count / total) * Math.PI * 2;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", donutSlicePath(cx, cy, radius, innerR, angle, angle + slice));
    path.setAttribute(
      "fill",
      PLATFORM_COLORS[entry.key] || "#94a3b8"
    );
    path.setAttribute("class", "donut-slice");
    svg.appendChild(path);
    angle += slice;
  }

  const center = document.createElementNS(svgNS, "text");
  center.setAttribute("x", String(cx));
  center.setAttribute("y", String(cy - 4));
  center.setAttribute("text-anchor", "middle");
  center.setAttribute("class", "donut-center-value");
  center.textContent = total.toLocaleString();
  svg.appendChild(center);

  const centerLabel = document.createElementNS(svgNS, "text");
  centerLabel.setAttribute("x", String(cx));
  centerLabel.setAttribute("y", String(cy + 14));
  centerLabel.setAttribute("text-anchor", "middle");
  centerLabel.setAttribute("class", "donut-center-label");
  centerLabel.textContent = "posts";
  svg.appendChild(centerLabel);

  const legend = document.createElement("div");
  legend.className = "donut-legend";
  legend.innerHTML = entries
    .map((entry) => {
      const pct = total ? (entry.count / total) * 100 : 0;
      const label = PLATFORM_LABELS[entry.key] || capitalize(entry.key);
      const color = PLATFORM_COLORS[entry.key] || "#94a3b8";
      return `<div class="donut-legend-row">
        <span class="legend-swatch" style="background:${color}"></span>
        <span class="donut-legend-name">${escapeHtml(label)}</span>
        <span class="donut-legend-value">${entry.count.toLocaleString()} · ${pct.toFixed(1)}%</span>
      </div>`;
    })
    .join("");

  wrap.append(svg, legend);
  container.replaceChildren(wrap);
}

export function stanceLegendHtml() {
  return STANCE_ORDER.map(
    (key) =>
      `<span class="legend-item"><span class="legend-swatch" style="background:${STANCE_COLORS[key]}"></span>${STANCE_LABELS[key]}</span>`
  ).join("");
}

function donutSlicePath(cx, cy, rOuter, rInner, a0, a1) {
  // Avoid zero-length arcs
  const end = a1 - a0 >= Math.PI * 2 - 1e-6 ? a0 + Math.PI * 2 - 1e-6 : a1;
  const large = end - a0 > Math.PI ? 1 : 0;
  const x0 = cx + Math.cos(a0) * rOuter;
  const y0 = cy + Math.sin(a0) * rOuter;
  const x1 = cx + Math.cos(end) * rOuter;
  const y1 = cy + Math.sin(end) * rOuter;
  const x2 = cx + Math.cos(end) * rInner;
  const y2 = cy + Math.sin(end) * rInner;
  const x3 = cx + Math.cos(a0) * rInner;
  const y3 = cy + Math.sin(a0) * rInner;
  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x3} ${y3}`,
    "Z",
  ].join(" ");
}

function niceTicks(max, count) {
  if (max <= 1) return [0, 1];
  const step = Math.max(1, Math.ceil(max / count));
  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
