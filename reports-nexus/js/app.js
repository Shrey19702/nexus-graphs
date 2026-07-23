/** Nexus report: load CSV + graph, aggregate, render HTML for PDF export. */

import { parseCsv } from "../../shared/js/csv.js";
import {
  STANCE_ORDER,
  STANCE_LABELS,
  STANCE_COLORS,
  PARENT_IMAGE,
  OVERVIEW_IMAGE,
  CSV_URL,
  GRAPH_URL,
  IMAGES_BASE,
} from "./constants.js";
import { enumerateDays, renderStackedTimeline, stanceLegendHtml } from "./charts.js";

export async function init() {
  const statusEl = document.getElementById("status");
  const reportEl = document.getElementById("report");
  const exportBtn = document.getElementById("export-pdf");

  setStatus(statusEl, "Loading data…");

  const [csvRes, graphRes] = await Promise.all([fetch(CSV_URL), fetch(GRAPH_URL)]);
  if (!csvRes.ok) throw new Error(`CSV fetch failed: ${csvRes.status}`);
  if (!graphRes.ok) throw new Error(`Graph fetch failed: ${graphRes.status}`);

  const [csvText, graph] = await Promise.all([csvRes.text(), graphRes.json()]);
  setStatus(statusEl, "Aggregating…");

  const rows = parseCsv(csvText);
  const model = buildReportModel(rows, graph);

  setStatus(statusEl, "Rendering…");
  renderReport(reportEl, model);

  reportEl.setAttribute("aria-busy", "false");
  exportBtn.disabled = false;
  exportBtn.addEventListener("click", () => window.print());
  setStatus(statusEl, `${model.totalPosts.toLocaleString()} posts · ready`);
}

function setStatus(el, text) {
  if (el) el.textContent = text;
}

function buildReportModel(rows, graph) {
  const parentOrder = parentOrderFromGraph(graph);
  const parentTopics = new Map();

  for (const name of parentOrder) {
    parentTopics.set(name, emptyParent(name));
  }

  const overallStance = emptyStanceCounts();
  let totalPosts = 0;
  let datedPosts = 0;

  for (const row of rows) {
    const parent = (row.parent_topic || "").trim();
    const topic = (row.topic || "").trim();
    if (!parent || !topic) continue;

    if (!parentTopics.has(parent)) {
      parentTopics.set(parent, emptyParent(parent));
      parentOrder.push(parent);
    }

    const stance = normalizeStance(row.stance);
    const day = dayFromPostedAt(row.posted_at);

    const parentBucket = parentTopics.get(parent);
    parentBucket.postCount += 1;
    if (stance) parentBucket.stance[stance] += 1;
    if (stance) overallStance[stance] += 1;
    totalPosts += 1;

    if (!parentBucket.topics.has(topic)) {
      parentBucket.topics.set(topic, emptyTopic(topic));
      parentBucket.topicOrder.push(topic);
    }
    const topicBucket = parentBucket.topics.get(topic);
    topicBucket.postCount += 1;
    if (stance) topicBucket.stance[stance] += 1;

    if (day && stance) {
      datedPosts += 1;
      topicBucket.series[stance][day] = (topicBucket.series[stance][day] || 0) + 1;
      if (!topicBucket.minDay || day < topicBucket.minDay) topicBucket.minDay = day;
      if (!topicBucket.maxDay || day > topicBucket.maxDay) topicBucket.maxDay = day;
    }
  }

  // Sort topics within each parent by post count desc
  for (const parent of parentTopics.values()) {
    parent.topicOrder.sort((a, b) => {
      const ca = parent.topics.get(a).postCount;
      const cb = parent.topics.get(b).postCount;
      return cb - ca || a.localeCompare(b);
    });
  }

  // Prefer graph parent order, then any extras by volume
  const orderedParents = [
    ...parentOrder.filter((n) => parentTopics.has(n)),
    ...[...parentTopics.keys()]
      .filter((n) => !parentOrder.includes(n))
      .sort(
        (a, b) =>
          parentTopics.get(b).postCount - parentTopics.get(a).postCount ||
          a.localeCompare(b)
      ),
  ];
  // de-dupe while preserving order
  const seen = new Set();
  const uniqueParents = [];
  for (const n of orderedParents) {
    if (seen.has(n)) continue;
    seen.add(n);
    uniqueParents.push(n);
  }

  return {
    totalPosts,
    datedPosts,
    parentCount: uniqueParents.length,
    overallStance,
    parents: uniqueParents.map((name) => {
      const p = parentTopics.get(name);
      return {
        name,
        postCount: p.postCount,
        stance: p.stance,
        image: PARENT_IMAGE[name] || null,
        topics: p.topicOrder.map((tName) => {
          const t = p.topics.get(tName);
          return {
            name: tName,
            postCount: t.postCount,
            stance: t.stance,
            days: daysForTopic(t),
            series: t.series,
          };
        }),
      };
    }),
  };
}

function parentOrderFromGraph(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const parents = [];
  for (const n of nodes) {
    if (n.type !== "parent_topic_node") continue;
    const label = (n.label || "").replace(/^Parent Topic:\s*/i, "").trim();
    const fromId = (n.id || "").replace(/^parent_topic_/, "").trim();
    const name = label || fromId;
    if (name && !parents.includes(name)) parents.push(name);
  }
  return parents;
}

function emptyParent(name) {
  return {
    name,
    postCount: 0,
    stance: emptyStanceCounts(),
    topics: new Map(),
    topicOrder: [],
  };
}

function emptyTopic(name) {
  return {
    name,
    postCount: 0,
    stance: emptyStanceCounts(),
    series: Object.fromEntries(STANCE_ORDER.map((k) => [k, Object.create(null)])),
    minDay: null,
    maxDay: null,
  };
}

function emptyStanceCounts() {
  return Object.fromEntries(STANCE_ORDER.map((k) => [k, 0]));
}

function normalizeStance(raw) {
  const s = (raw || "").trim();
  if (STANCE_ORDER.includes(s)) return s;
  return null;
}

function dayFromPostedAt(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Prefer continuous daily axis; fall back to active days when span is sparse. */
function daysForTopic(topic) {
  if (!topic.minDay || !topic.maxDay) return [];
  const active = new Set();
  for (const key of STANCE_ORDER) {
    for (const day of Object.keys(topic.series[key] || {})) active.add(day);
  }
  const activeDays = [...active].sort();
  if (!activeDays.length) return [];

  const continuous = enumerateDays(topic.minDay, topic.maxDay);
  // Avoid multi-year empty axes from a handful of outlier timestamps.
  if (continuous.length > 45 && continuous.length > activeDays.length * 2) {
    return activeDays;
  }
  return continuous;
}

function renderReport(root, model) {
  const frag = document.createDocumentFragment();

  frag.appendChild(renderCover(model));

  for (const parent of model.parents) {
    frag.appendChild(renderParentSection(parent));
  }

  root.replaceChildren(frag);
}

function renderCover(model) {
  const section = el("section", "page page-cover");
  section.innerHTML = `
    <header class="cover-header">
      <p class="kicker">Report</p>
      <h1 class="cover-title">THE NEXUS</h1>
    </header>
    <figure class="cover-figure">
      <img src="${IMAGES_BASE}${OVERVIEW_IMAGE}" alt="Overall Nexus graph" class="cover-image" />
    </figure>
    <div class="cover-stats">
      <div class="stat">
        <div class="stat-value">${model.totalPosts.toLocaleString()}</div>
        <div class="stat-label">Total posts</div>
      </div>
      <div class="stat">
        <div class="stat-value">${model.parentCount}</div>
        <div class="stat-label">Parent topics</div>
      </div>
    </div>
    <div class="block">
      <h2 class="block-title">Parent topics</h2>
      <ol class="parent-list">
        ${model.parents
          .map(
            (p, i) =>
              `<li><span class="parent-list-index">${i + 1}</span><span class="parent-list-name">${escapeHtml(p.name)}</span><span class="parent-list-count">${p.postCount.toLocaleString()}</span></li>`
          )
          .join("")}
      </ol>
    </div>
    <div class="block">
      <h2 class="block-title">Overall sentiment</h2>
      <div class="legend">${stanceLegendHtml()}</div>
      ${stanceBarsHtml(model.overallStance, model.totalPosts)}
    </div>
  `;
  return section;
}

function renderParentSection(parent) {
  const section = el("section", "page page-parent");
  const imgHtml = parent.image
    ? `<figure class="parent-figure"><img src="${IMAGES_BASE}${parent.image}" alt="${escapeHtml(parent.name)} graph" class="parent-image" /></figure>`
    : "";

  const topicsList = parent.topics
    .map(
      (t) =>
        `<li><span class="topic-name">${escapeHtml(t.name)}</span><span class="topic-count">${t.postCount.toLocaleString()}</span></li>`
    )
    .join("");

  section.innerHTML = `
    <header class="parent-header">
      <p class="kicker">Parent topic</p>
      <h1 class="parent-title">${escapeHtml(parent.name)}</h1>
      <p class="parent-meta">${parent.postCount.toLocaleString()} posts · ${parent.topics.length} internal topics</p>
    </header>
    ${imgHtml}
    <div class="block">
      <h2 class="block-title">Sentiment</h2>
      <div class="legend">${stanceLegendHtml()}</div>
      ${stanceBarsHtml(parent.stance, parent.postCount)}
    </div>
    <div class="block">
      <h2 class="block-title">Internal topics</h2>
      <ol class="topic-list">${topicsList}</ol>
    </div>
    <div class="block timelines">
      <h2 class="block-title">Timelines by internal topic</h2>
      <p class="muted">Daily post counts with sentiment distribution inside each bar.</p>
      <div class="legend">${stanceLegendHtml()}</div>
      <div class="timeline-list" data-parent="${escapeHtml(parent.name)}"></div>
    </div>
  `;

  const list = section.querySelector(".timeline-list");
  for (const topic of parent.topics) {
    const card = el("article", "timeline-card");
    card.innerHTML = `
      <header class="timeline-card-header">
        <h3 class="timeline-card-title">${escapeHtml(topic.name)}</h3>
        <p class="timeline-card-meta">${topic.postCount.toLocaleString()} posts</p>
      </header>
      <div class="timeline-chart-wrap"></div>
    `;
    const wrap = card.querySelector(".timeline-chart-wrap");
    renderStackedTimeline(wrap, {
      days: topic.days,
      series: topic.series,
    });
    list.appendChild(card);
  }

  return section;
}

function stanceBarsHtml(counts, total) {
  const rows = STANCE_ORDER.map((key) => {
    const n = counts[key] || 0;
    const pct = total ? (n / total) * 100 : 0;
    return `
      <div class="stance-row">
        <div class="stance-row-label">${STANCE_LABELS[key]}</div>
        <div class="stance-row-track">
          <div class="stance-row-fill" style="width:${pct.toFixed(2)}%;background:${STANCE_COLORS[key]}"></div>
        </div>
        <div class="stance-row-value">${n.toLocaleString()} <span class="pct">${pct.toFixed(1)}%</span></div>
      </div>`;
  }).join("");
  return `<div class="stance-bars">${rows}</div>`;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
