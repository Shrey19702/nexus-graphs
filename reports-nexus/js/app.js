/** Nexus report: load CSV + graph, aggregate, render HTML for PDF export. */

import { parseCsv } from "../../shared/js/csv.js";
import { loadNexusDataConfig } from "../../shared/js/data-config.js?v=2026-08-26-hub-images";
import {
  normalizeStance,
  orderStances,
  stanceColor,
  stanceLabel,
} from "../../shared/js/theme.js?v=2026-08-21-anti-orange";
import {
  OVERVIEW_IMAGE,
  IMAGES_BASE,
  TIMELINE_START_DAY,
  timelineEndDay,
} from "./constants.js?v=2026-08-26-hub-images";
import {
  daysForSeriesBucket,
  renderStackedTimeline,
  renderPlatformDonut,
  stanceLegendHtml,
  formatDayLabel,
} from "./charts.js?v=2026-08-15-ap";

export async function init() {
  const statusEl = document.getElementById("status");
  const reportEl = document.getElementById("report");
  const exportBtn = document.getElementById("export-pdf");

  setStatus(statusEl, "Loading config…");
  const dataConfig = await loadNexusDataConfig();
  const csvUrl = dataConfig.csvUrl;
  const graphUrl = dataConfig.graphUrl;
  const imagesBase = dataConfig.imagesBaseUrl || IMAGES_BASE;
  const overviewImage = dataConfig.overview_image || "";
  const themeImages = dataConfig.themeImages || {};
  // Bust browser cache when generate-report-images updates PNGs (same filenames).
  const imageCacheKey = dataConfig.images_version || String(Date.now());
  const timelineStart = dataConfig.timeline_start || TIMELINE_START_DAY;
  document.title = `Report · ${dataConfig.corpusLabel}`;

  setStatus(statusEl, `Loading ${dataConfig.corpusLabel}…`);

  const [csvRes, graphRes] = await Promise.all([fetch(csvUrl), fetch(graphUrl)]);
  if (!csvRes.ok) throw new Error(`CSV fetch failed: ${csvUrl} (${csvRes.status})`);
  if (!graphRes.ok) throw new Error(`Graph fetch failed: ${graphUrl} (${graphRes.status})`);

  const [csvText, graph] = await Promise.all([csvRes.text(), graphRes.json()]);
  setStatus(statusEl, "Aggregating…");

  const rows = parseCsv(csvText);
  const model = buildReportModel(rows, graph, { timelineStart, themeImages });
  model.imagesBase = imagesBase;
  model.overviewImage = overviewImage;
  model.imageCacheKey = imageCacheKey;

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

function buildReportModel(rows, graph, { timelineStart = TIMELINE_START_DAY, themeImages = {} } = {}) {
  const themeOrder = themeOrderFromGraph(graph);
  const themes = new Map();
  const stanceKeys = [];

  for (const name of themeOrder) {
    themes.set(name, emptyTheme(name));
  }

  const overallStance = Object.create(null);
  const overallSeries = Object.create(null);
  let overallMinDay = null;
  let overallMaxDay = null;
  const platforms = Object.create(null);
  let totalPosts = 0;
  let datedPosts = 0;

  for (const row of rows) {
    const theme = (row.parent_topic || "").trim();
    const topic = (row.topic || "").trim();
    if (!theme || !topic) continue;

    if (!themes.has(theme)) {
      themes.set(theme, emptyTheme(theme));
      themeOrder.push(theme);
    }

    const stance = normalizeStance(row.stance);
    const day = dayFromPostedAt(row.posted_at);
    const platform =
      normalizePlatform(row.platform) || platformFromUrl(row.url);

    const themeBucket = themes.get(theme);
    themeBucket.postCount += 1;
    if (stance) {
      if (!Object.prototype.hasOwnProperty.call(overallStance, stance)) {
        stanceKeys.push(stance);
      }
      themeBucket.stance[stance] = (themeBucket.stance[stance] || 0) + 1;
      overallStance[stance] = (overallStance[stance] || 0) + 1;
    }
    totalPosts += 1;

    if (platform) {
      platforms[platform] = (platforms[platform] || 0) + 1;
    }

    if (!themeBucket.topics.has(topic)) {
      themeBucket.topics.set(topic, { name: topic, postCount: 0 });
      themeBucket.topicOrder.push(topic);
    }
    themeBucket.topics.get(topic).postCount += 1;

    if (day && stance) {
      datedPosts += 1;
      bumpSeries(themeBucket.series, stance, day);
      bumpSeries(overallSeries, stance, day);
      themeBucket.minDay = minDay(themeBucket.minDay, day);
      themeBucket.maxDay = maxDay(themeBucket.maxDay, day);
      overallMinDay = minDay(overallMinDay, day);
      overallMaxDay = maxDay(overallMaxDay, day);
    }
  }

  const stanceOrder = orderStances(stanceKeys);

  for (const theme of themes.values()) {
    theme.topicOrder.sort((a, b) => {
      const ca = theme.topics.get(a).postCount;
      const cb = theme.topics.get(b).postCount;
      return cb - ca || a.localeCompare(b);
    });
  }

  const orderedThemes = [
    ...themeOrder.filter((n) => themes.has(n)),
    ...[...themes.keys()]
      .filter((n) => !themeOrder.includes(n))
      .sort(
        (a, b) =>
          themes.get(b).postCount - themes.get(a).postCount || a.localeCompare(b)
      ),
  ];
  const seen = new Set();
  const uniqueThemes = [];
  for (const n of orderedThemes) {
    if (seen.has(n)) continue;
    seen.add(n);
    uniqueThemes.push(n);
  }

  const overallBucket = {
    series: overallSeries,
    minDay: overallMinDay,
    maxDay: overallMaxDay,
  };

  const timelineWindow = {
    startDay: timelineStart,
    endDay: timelineEndDay(),
  };

  return {
    totalPosts,
    datedPosts,
    themeCount: uniqueThemes.length,
    stanceOrder,
    overallStance,
    overallDays: daysForSeriesBucket(overallBucket, timelineWindow),
    overallSeries,
    timelineWindow,
    imagesBase: IMAGES_BASE,
    overviewImage: OVERVIEW_IMAGE,
    imageCacheKey: "",
    platforms,
    themes: uniqueThemes.map((name) => {
      const t = themes.get(name);
      return {
        name,
        postCount: t.postCount,
        stance: t.stance,
        image: themeImages[name] || null,
        days: daysForSeriesBucket(t, timelineWindow),
        series: t.series,
        topics: t.topicOrder.map((topicName) => ({
          name: topicName,
          postCount: t.topics.get(topicName).postCount,
        })),
      };
    }),
  };
}

function themeOrderFromGraph(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const themes = [];
  for (const n of nodes) {
    if (n.type !== "parent_topic_node") continue;
    const label = (n.label || "").replace(/^Parent Topic:\s*/i, "").trim();
    const fromId = (n.id || "").replace(/^parent_topic_/, "").trim();
    const name = label || fromId;
    if (name && !themes.includes(name)) themes.push(name);
  }
  return themes;
}

function emptyTheme(name) {
  return {
    name,
    postCount: 0,
    stance: Object.create(null),
    series: Object.create(null),
    minDay: null,
    maxDay: null,
    topics: new Map(),
    topicOrder: [],
  };
}

function bumpSeries(series, stance, day) {
  if (!series[stance]) series[stance] = Object.create(null);
  series[stance][day] = (series[stance][day] || 0) + 1;
}

function minDay(current, day) {
  return !current || day < current ? day : current;
}

function maxDay(current, day) {
  return !current || day > current ? day : current;
}

function normalizePlatform(raw) {
  const p = (raw || "").trim().toLowerCase();
  if (!p) return null;
  if (p === "twitter") return "x";
  if (p === "yt") return "youtube";
  if (p === "fb") return "facebook";
  if (p === "ig") return "instagram";
  return p;
}

/** Infer platform when the CSV has no `platform` column (e.g. STK dumps). */
function platformFromUrl(url) {
  const u = String(url || "").toLowerCase();
  if (!u) return null;
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("facebook.com") || u.includes("fb.com") || u.includes("fb.watch")) {
    return "facebook";
  }
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("reddit.com")) return "reddit";
  if (u.includes("twitter.com") || u.includes("x.com")) return "x";
  return null;
}

function dayFromPostedAt(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function renderReport(root, model) {
  const frag = document.createDocumentFragment();
  const params = new URLSearchParams(window.location.search);
  const onlyParam = params.get("only");
  const coverOnly = params.get("cover") === "1";
  const themesOnly = onlyParam
    ? onlyParam.split(/[|~]+/).map((s) => s.trim()).filter(Boolean)
    : null;

  if (!themesOnly) {
    frag.appendChild(renderCover(model));
  }
  if (!coverOnly) {
    const themes = themesOnly
      ? model.themes.filter((t) => themesOnly.includes(t.name))
      : model.themes;
    for (const theme of themes) {
      frag.appendChild(
        renderThemeSection(
          theme,
          model.timelineWindow,
          model.imagesBase,
          model.imageCacheKey,
          model.stanceOrder
        )
      );
    }
  }
  root.replaceChildren(frag);
}

function timelineCaption(window) {
  if (!window?.startDay || !window?.endDay) {
    return "Daily post counts with sentiment distribution inside each bar.";
  }
  return `Daily post counts from ${formatDayLabel(window.startDay)} to ${formatDayLabel(window.endDay)} (older posts counted in totals only).`;
}

function renderCover(model) {
  const section = el("section", "page page-cover");
  const coverImage = model.overviewImage
    ? `<figure class="cover-figure">
      <img src="${imageUrl(model.imagesBase, model.overviewImage, model.imageCacheKey)}" alt="Overall Nexus graph" class="cover-image" />
    </figure>`
    : "";
  section.innerHTML = `
    <header class="cover-header">
      <p class="kicker">Report</p>
      <h1 class="cover-title">THE NEXUS</h1>
    </header>
    ${coverImage}
    <div class="cover-stats">
      <div class="stat">
        <div class="stat-value">${model.totalPosts.toLocaleString()}</div>
        <div class="stat-label">Total posts</div>
      </div>
      <div class="stat">
        <div class="stat-value">${model.themeCount}</div>
        <div class="stat-label">Themes</div>
      </div>
    </div>
    <div class="block">
      <h2 class="block-title">Themes</h2>
      <ol class="theme-list">
        ${model.themes
          .map(
            (t, i) =>
              `<li><span class="theme-list-index">${i + 1}</span><span class="theme-list-name">${escapeHtml(t.name)}</span><span class="theme-list-count">${t.postCount.toLocaleString()}</span></li>`
          )
          .join("")}
      </ol>
    </div>
    <div class="block">
      <h2 class="block-title">Overall sentiment</h2>
      <div class="legend">${stanceLegendHtml(model.stanceOrder)}</div>
      ${stanceBarsHtml(model.overallStance, model.totalPosts, model.stanceOrder)}
    </div>
    <div class="block">
      <h2 class="block-title">Overall timeline</h2>
      <p class="muted">${escapeHtml(timelineCaption(model.timelineWindow))}</p>
      <div class="legend">${stanceLegendHtml(model.stanceOrder)}</div>
      <div class="timeline-chart-wrap" data-overall-timeline></div>
    </div>
    <div class="block">
      <h2 class="block-title">Platform ratio</h2>
      <div class="platform-donut" data-platform-donut></div>
    </div>
  `;

  renderStackedTimeline(section.querySelector("[data-overall-timeline]"), {
    days: model.overallDays,
    series: model.overallSeries,
    stanceOrder: model.stanceOrder,
    height: 190,
  });
  renderPlatformDonut(section.querySelector("[data-platform-donut]"), {
    counts: model.platforms,
    total: Object.values(model.platforms).reduce((a, b) => a + b, 0),
  });

  return section;
}

function imageUrl(imagesBase, filename, cacheKey = "") {
  if (!filename) return "";
  // Encode the filename only — keeps `&` etc. safe in HTML src / HTTP paths.
  const path = `${imagesBase}${String(filename).split("/").map(encodeURIComponent).join("/")}`;
  if (!cacheKey) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}v=${encodeURIComponent(cacheKey)}`;
}

function renderThemeSection(
  theme,
  timelineWindow,
  imagesBase = IMAGES_BASE,
  imageCacheKey = "",
  stanceOrder = []
) {
  const section = el("section", "page page-theme");
  const imgHtml = theme.image
    ? `<figure class="theme-figure"><img src="${imageUrl(imagesBase, theme.image, imageCacheKey)}" alt="${escapeHtml(theme.name)} graph" class="theme-image" /></figure>`
    : "";

  const topicsList = theme.topics
    .map(
      (t) =>
        `<li><span class="topic-name">${escapeHtml(t.name)}</span><span class="topic-count">${t.postCount.toLocaleString()}</span></li>`
    )
    .join("");

  section.innerHTML = `
    <header class="theme-header">
      <p class="kicker">Theme</p>
      <h1 class="theme-title">${escapeHtml(theme.name)}</h1>
      <p class="theme-meta">${theme.postCount.toLocaleString()} posts · ${theme.topics.length} internal topics</p>
    </header>
    ${imgHtml}
    <div class="block">
      <h2 class="block-title">Sentiment</h2>
      <div class="legend">${stanceLegendHtml(stanceOrder)}</div>
      ${stanceBarsHtml(theme.stance, theme.postCount, stanceOrder)}
    </div>
    <div class="block">
      <h2 class="block-title">Internal topics</h2>
      <ol class="topic-list topic-list-columns">${topicsList}</ol>
    </div>
    <div class="block">
      <h2 class="block-title">Timeline</h2>
      <p class="muted">${escapeHtml(timelineCaption(timelineWindow))}</p>
      <div class="legend">${stanceLegendHtml(stanceOrder)}</div>
      <div class="timeline-chart-wrap" data-theme-timeline></div>
    </div>
  `;

  renderStackedTimeline(section.querySelector("[data-theme-timeline]"), {
    days: theme.days,
    series: theme.series,
    stanceOrder,
    height: 180,
  });

  return section;
}

function stanceBarsHtml(counts, total, stanceOrder = []) {
  const rows = stanceOrder
    .map((key) => {
      const n = counts[key] || 0;
      const pct = total ? (n / total) * 100 : 0;
      return `
      <div class="stance-row">
        <div class="stance-row-label">${escapeHtml(stanceLabel(key))}</div>
        <div class="stance-row-track">
          <div class="stance-row-fill" style="width:${pct.toFixed(2)}%;background:${stanceColor(key)}"></div>
        </div>
        <div class="stance-row-value">${n.toLocaleString()} <span class="pct">${pct.toFixed(1)}%</span></div>
      </div>`;
    })
    .join("");
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
