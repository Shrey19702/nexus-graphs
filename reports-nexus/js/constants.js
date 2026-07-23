/** Stance labels/colors for the Nexus report (report-facing names). */

export const STANCE_ORDER = [
  "anti_government",
  "anti_cjp",
  "neutral_news",
  "pro_cjp",
  "pro_government",
];

export const STANCE_LABELS = {
  anti_government: "Anti-Government",
  anti_cjp: "Anti-CJP",
  neutral_news: "Neutral",
  pro_cjp: "Pro-CJP",
  pro_government: "Pro-Government",
};

export const STANCE_COLORS = {
  anti_government: "#D64545",
  anti_cjp: "#E8853D",
  neutral_news: "#9AA5B1",
  pro_cjp: "#94C25E",
  pro_government: "#1B7F5C",
};

export const PARENT_IMAGE = {
  "Protests and Activism": "protests_n_activism.png",
  "Political Figures and Parties": "political_figures_n_parties.png",
  "Sonam Wangchuk's Hunger Strike": "sonam_wangchuk_hunger_strike.png",
  "Education System and Reforms": "education_system_n_reforms.png",
  "CJP Movement and Controversies": "cjp_movement_n_controvercies.png",
  "Social and Cultural Issues": "social_n_cultural_issues.png",
  "Governance and Policy": "government_n_policy.png",
  "Legal and Judicial Matters": "legal_n_judcial_matters.png",
};

export const OVERVIEW_IMAGE = "narrative-graph.png";

export const CSV_URL = "../narratives-graph/CJP_Master_Nexus_Input_22_July.csv";
export const GRAPH_URL = "../narratives-graph/graph2_parent_topic_topic_22_07.json";
export const IMAGES_BASE = "../images/";
