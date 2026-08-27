/** Shared Civic Signal theme + stance palette (used by both graph apps). */

export const COLORS_BASE = {
  bg: "#FAFBFC",
  edge: "#D9DEE4",
  text: "#1F2937",
  mutedText: "#6B7280",
  selectionRing: "#2563EB",
  postFallback: "#9AA5B1",
  postNoData: "#E9ECF0",
  megaSelectedStroke: "#2563EB",
  hoverStroke: "#6B7280",
  tooltipBg: "rgba(255, 255, 255, 0.96)",
  tooltipText: "#1F2937",
  tooltipBorder: "#D9DEE4",
  orphan: "#9AA5B1",
  orphanStroke: "#CBD2DA",
  dimAlpha: 0.22,
};

/** Dull palette historically used by platform mega-nodes. */
export const DULL_PALETTE = [
  "#7d8b99",
  "#8a7f72",
  "#6f8579",
  "#7c748c",
  "#8a7a6c",
  "#6e8490",
  "#85786e",
  "#748a80",
  "#8a7482",
  "#6f7f8a",
  "#87856f",
  "#7a6e82",
  "#708890",
];

/**
 * Optional stable colors for known stance ids.
 * anti_government stays red; every other anti_* uses orange / amber / mustard
 * so it does not collide with government-red on the graph.
 * Unknown ids still get a color from the anti / pro / neutral palettes below —
 * graph and report axes are always discovered from the CSV.
 */
export const STANCE_COLORS = {
  anti_government: "#C44B4B",
  anti_india: "#E07020",
  anti_cjp: "#F08A24",
  anti_stk: "#E5A012",
  anti_dnp: "#D97706",
  anti_e20_jp: "#E8C547",
  anti_rha: "#C9A227",
  neutral: "#9AA5B1",
  neutral_news: "#9AA5B1",
  unclear: "#CBD2DA",
  mixed: "#A8B0BA",
  pro_rha: "#B8D4A0",
  pro_e20_jp: "#A0C878",
  pro_cjp: "#94C25E",
  pro_government: "#1B7F5C",
  pro_china: "#3B6FBF",
};

export const STANCE_LABELS = {
  anti_india: "Anti-India",
  anti_government: "Anti-Government",
  anti_cjp: "Anti-CJP",
  anti_stk: "Anti-STK",
  anti_dnp: "Anti-DNP",
  anti_e20_jp: "Anti-E20JP",
  anti_rha: "Anti-RHA",
  neutral: "Neutral",
  neutral_news: "Neutral / news",
  unclear: "Unclear",
  mixed: "Mixed",
  pro_rha: "Pro-RHA",
  pro_e20_jp: "Pro-E20JP",
  pro_cjp: "Pro-CJP",
  pro_government: "Pro-Government",
  pro_china: "Pro-China",
};

export const UNKNOWN_STANCE = "unknown";
export const BLAND_GREY = "#E9ECF0";

/**
 * Orange / yellow / mustard only — never red/rose (reserved for anti_government).
 * Used for unrecognized anti_* keys.
 */
const ANTI_FALLBACK_PALETTE = [
  "#F08A24",
  "#E5A012",
  "#D97706",
  "#E8C547",
  "#C96A1A",
  "#C9A227",
];

/** Greens / teals for unrecognized pro_* keys. */
const PRO_FALLBACK_PALETTE = [
  "#1B7F5C",
  "#3B8F5C",
  "#94C25E",
  "#2A7A8C",
  "#5A9E6E",
  "#3B6FBF",
];

const OTHER_FALLBACK_PALETTE = [
  "#7C6A5A",
  "#5A6B7C",
  "#6A7C5A",
  "#7A5A6B",
  "#5A7C74",
  "#7C725A",
];

const NEUTRAL_STANCE_RE = /^(neutral|neutral_news|news|unclear|mixed)$/i;

/** Map legacy / alternate CSV keys onto canonical stance ids. */
const STANCE_ALIASES = {
  anti_e20: "anti_e20_jp",
  pro_e20: "pro_e20_jp",
  news: "neutral",
};

export function normalizeStance(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  return STANCE_ALIASES[s] || s;
}

export function stanceLabel(key) {
  if (!key || key === UNKNOWN_STANCE) return "No sentiment";
  if (STANCE_LABELS[key]) return STANCE_LABELS[key];
  return String(key)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

/** anti_* → neutral/mixed → pro_* → other, then alpha. */
export function orderStances(keys) {
  const unique = [...new Set((keys || []).filter(Boolean))];
  unique.sort((a, b) => {
    const ra = stanceAxisRank(a);
    const rb = stanceAxisRank(b);
    return ra - rb || a.localeCompare(b);
  });
  return unique;
}

function stanceAxisRank(key) {
  const k = String(key || "");
  if (k.startsWith("anti_")) return 0;
  if (NEUTRAL_STANCE_RE.test(k)) return 1;
  if (k.startsWith("pro_")) return 2;
  return 3;
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function darkenHex(hex, amount = 0.22) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const f = (c) => Math.max(0, Math.round(c * (1 - amount)));
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function lightenHex(hex, amount = 0.35) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const f = (c) => Math.min(255, Math.round(c + (255 - c) * amount));
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgba(hex, alpha) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function stanceColor(stance) {
  const key = normalizeStance(stance);
  if (!key || key === UNKNOWN_STANCE) return BLAND_GREY;
  if (STANCE_COLORS[key]) return STANCE_COLORS[key];

  const h = hashString(key);
  if (key.startsWith("anti_")) {
    return ANTI_FALLBACK_PALETTE[h % ANTI_FALLBACK_PALETTE.length];
  }
  if (key.startsWith("pro_")) {
    return PRO_FALLBACK_PALETTE[h % PRO_FALLBACK_PALETTE.length];
  }
  if (NEUTRAL_STANCE_RE.test(key)) return "#9AA5B1";
  return OTHER_FALLBACK_PALETTE[h % OTHER_FALLBACK_PALETTE.length];
}

export function stanceKey(post) {
  const raw = post?.stance || post?.sentiment?.stance;
  return normalizeStance(raw) || UNKNOWN_STANCE;
}
