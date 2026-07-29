/** Stance labels/colors for the Nexus report (report-facing names). */

export const STANCE_ORDER = [
  "anti_government",
  "anti_cjp",
  "anti_e20",
  "anti_rha",
  "neutral_news",
  "pro_rha",
  "pro_e20",
  "pro_cjp",
  "pro_government",
];

export const STANCE_LABELS = {
  anti_government: "Anti-Government",
  anti_cjp: "Anti-CJP",
  anti_e20: "Anti-E20JP",
  anti_rha: "Anti-RHA",
  neutral_news: "Neutral / news",
  pro_rha: "Pro-RHA",
  pro_e20: "Pro-E20JP",
  pro_cjp: "Pro-CJP",
  pro_government: "Pro-Government",
};

export const STANCE_COLORS = {
  anti_government: "#D64545",
  anti_cjp: "#E8853D",
  anti_e20: "#E8A94A",
  anti_rha: "#D4B56A",
  neutral_news: "#9AA5B1",
  pro_rha: "#B8D4A0",
  pro_e20: "#A0C878",
  pro_cjp: "#94C25E",
  pro_government: "#1B7F5C",
};

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

export const THEME_IMAGE = {
  "Protests and Activism": "protests_n_activism.png",
  "Political Figures and Parties": "political_figures_n_parties.png",
  "Sonam Wangchuk's Hunger Strike": "sonam_wangchuk_hunger_strike.png",
  "Education System and Reforms": "education_system_n_reforms.png",
  "CJP Movement and Controversies": "cjp_movement_n_controvercies.png",
  "Social and Cultural Issues": "social_n_cultural_issues.png",
  "Governance and Policy": "government_n_policy.png",
  "Legal and Judicial Matters": "legal_n_judcial_matters.png",
  "E20 Janta Party & Fuel Choice Movement":
    "E20_Janta_Party_and_Fuel_Choice_Movement.png",
  "Reservation Hatao Movement": "Reservation_Hatao_Movement.png",
  "Post-Resignation Education Ministry Developments":
    "Post_Resignation_Education_Ministry_Developments.png",
};

export const OVERVIEW_IMAGE = "narrative-graph.png";

export const IMAGES_BASE = "../images/";

/** Timeline charts only — older posts still count in totals/sentiment.
 *  Overridden at runtime by shared/nexus-data.yml when present. */
export const TIMELINE_START_DAY = "2026-07-01";

export function timelineEndDay() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
