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

export const STANCE_COLORS = {
  anti_government: "#D64545",
  anti_cjp: "#E8853D",
  anti_e20_jp: "#E8A94A",
  anti_rha: "#D4B56A",
  neutral_news: "#9AA5B1",
  unclear: "#CBD2DA",
  mixed: "#A8B0BA",
  pro_rha: "#B8D4A0",
  pro_e20_jp: "#A0C878",
  pro_cjp: "#94C25E",
  pro_government: "#1B7F5C",
};

export const STANCE_LABELS = {
  anti_government: "Anti-Government",
  anti_cjp: "Anti-CJP",
  anti_e20_jp: "Anti-E20JP",
  anti_rha: "Anti-RHA",
  neutral_news: "Neutral / news",
  unclear: "Unclear",
  mixed: "Mixed",
  pro_rha: "Pro-RHA",
  pro_e20_jp: "Pro-E20JP",
  pro_cjp: "Pro-CJP",
  pro_government: "Pro-Government",
};

export const UNKNOWN_STANCE = "unknown";
export const BLAND_GREY = "#E9ECF0";

/** Map legacy / alternate CSV keys onto the canonical stance ids. */
const STANCE_ALIASES = {
  anti_e20: "anti_e20_jp",
  pro_e20: "pro_e20_jp",
};

export function normalizeStance(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const canonical = STANCE_ALIASES[s] || s;
  return STANCE_COLORS[canonical] ? canonical : null;
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
  return STANCE_COLORS[key] || BLAND_GREY;
}

export function stanceKey(post) {
  const raw = post?.stance || post?.sentiment?.stance;
  return normalizeStance(raw) || UNKNOWN_STANCE;
}
