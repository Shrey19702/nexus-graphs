/** Platform + image constants for the Nexus report.
 *  Stance axis is discovered from the CSV (see shared/js/theme.js). */

export const PLATFORM_ORDER = ["youtube", "x", "facebook", "instagram", "reddit"];

export const PLATFORM_LABELS = {
  youtube: "YouTube",
  x: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
};

export const PLATFORM_COLORS = {
  youtube: "#FF0000",
  x: "#111827",
  facebook: "#1877F2",
  instagram: "#E4405F",
  reddit: "#FF4500",
};

export const OVERVIEW_IMAGE = "narrative-graph.png";

/** Fallback only — report uses corpus.images_base from corpora.js. */
export const IMAGES_BASE = "/images/stk/";

/** Timeline charts only — older posts still count in totals/sentiment.
 *  Overridden at runtime by corpus.timeline_start in corpora.js. */
export const TIMELINE_START_DAY = "2026-08-08";

export function timelineEndDay() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
