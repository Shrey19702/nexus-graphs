/** Stacked timeline bar charts (SVG) for report PDF output. */

import { STANCE_ORDER, STANCE_COLORS, STANCE_LABELS } from "./constants.js";

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
    container.innerHTML = `<p class="muted">No dated posts for this topic.</p>`;
    return;
  }

  const height = opts.height ?? 148;
  const width = Math.max(520, days.length * 28 + 56);
  const margin = { top: 10, right: 8, bottom: 36, left: 36 };
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

export function stanceLegendHtml() {
  return STANCE_ORDER.map(
    (key) =>
      `<span class="legend-item"><span class="legend-swatch" style="background:${STANCE_COLORS[key]}"></span>${STANCE_LABELS[key]}</span>`
  ).join("");
}

function niceTicks(max, count) {
  if (max <= 1) return [0, 1];
  const step = Math.max(1, Math.ceil(max / count));
  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}
