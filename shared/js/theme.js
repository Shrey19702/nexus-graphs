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
  pro_government: "#1B7F5C",
  pro_cjp: "#94C25E",
  neutral_news: "#9AA5B1",
  unclear: "#CBD2DA",
  mixed: "#A8B0BA",
  anti_cjp: "#E8853D",
  anti_government: "#D64545",
};

export const STANCE_LABELS = {
  pro_government: "Pro government",
  pro_cjp: "Pro CJP",
  neutral_news: "Neutral / news",
  unclear: "Unclear",
  mixed: "Mixed",
  anti_cjp: "Anti CJP",
  anti_government: "Anti government",
};

export const UNKNOWN_STANCE = "unknown";
export const BLAND_GREY = "#E9ECF0";

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
  if (!stance || stance === UNKNOWN_STANCE) return BLAND_GREY;
  return STANCE_COLORS[stance] || BLAND_GREY;
}

export function stanceKey(post) {
  const s = post?.stance || post?.sentiment?.stance;
  if (s && STANCE_COLORS[s]) return s;
  return UNKNOWN_STANCE;
}
