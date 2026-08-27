/**
 * Nexus corpora — one entry per dataset shown on the hub.
 * Paths are relative to the repository root.
 * Report PNGs live in images/<id>/ so hubs never overwrite each other.
 */

export const DEFAULT_CORPUS_ID = "stk";

export const CORPORA = {
  cjp: {
    id: "cjp",
    label: "CJP",
    title: "Cockroach Janta Party",
    csv: "cjp_data/CJP_Master_Nexus_Input_30_July.csv",
    graph: "cjp_data/graph2_parent_topic_topic_30_07.json",
    images_base: "images/cjp/",
    overview_image: "narrative-graph.png",
    timeline_start: "2026-07-01",
    hasPostedAt: true,
    hasPlatform: true,
    profiles: true,
  },
  ap: {
    id: "ap",
    label: "AP",
    title: "Arunachal Pradesh",
    csv: "AP_data/AP_Master_12_14_Aug.csv",
    graph: "AP_data/graph2_parent_topic_topic_14_08.json",
    images_base: "images/ap/",
    overview_image: "narrative-graph.png",
    timeline_start: "2026-08-08",
    hasPostedAt: true,
    hasPlatform: true,
    profiles: false,
  },
  stk: {
    id: "stk",
    label: "STK",
    title: "School Thik Karo",
    csv: "stk_data/19-26_Aug_moderation_output.csv",
    graph: "stk_data/graph2_parent_topic_topic_19_26_Aug.json",
    images_base: "images/stk/",
    overview_image: "narrative-graph.png",
    timeline_start: "2026-08-10",
    hasPostedAt: false,
    hasPlatform: false,
    profiles: false,
  },
  dnp: {
    id: "dnp",
    label: "DNP",
    title: "Dimagi Naxal Party",
    csv: "DNP/19-25_Aug_moderation_output.csv",
    graph: "DNP/graph2_parent_topic_topic_19_25_Aug.json",
    images_base: "images/dnp/",
    overview_image: "narrative-graph.png",
    timeline_start: "2026-08-08",
    hasPostedAt: false,
    hasPlatform: false,
    profiles: false,
  },
};

export const CORPUS_ORDER = ["cjp", "ap", "stk", "dnp"];

const STORAGE_KEY = "nexus.corpus";

export function getCorpus(id) {
  const key = String(id || "").trim().toLowerCase();
  return CORPORA[key] || null;
}

export function listCorpora() {
  return CORPUS_ORDER.map((id) => CORPORA[id]).filter(Boolean);
}

/** Persist selection so Themes ↔ Report keep the same corpus. */
export function rememberCorpus(id) {
  const corpus = getCorpus(id);
  if (!corpus || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, corpus.id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readRememberedCorpusId() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Resolve corpus from (in order): explicit id, ?corpus=, sessionStorage, default.
 * @param {string} [explicitId]
 * @param {string|URLSearchParams} [search]
 */
export function resolveCorpusId(explicitId, search) {
  if (getCorpus(explicitId)) return getCorpus(explicitId).id;

  let params = search;
  if (typeof search === "string") params = new URLSearchParams(search);
  else if (typeof window !== "undefined" && !params) {
    params = new URLSearchParams(window.location.search);
  }
  if (params) {
    const fromQuery = params.get("corpus");
    if (getCorpus(fromQuery)) return getCorpus(fromQuery).id;
  }

  const remembered = readRememberedCorpusId();
  if (getCorpus(remembered)) return getCorpus(remembered).id;

  return DEFAULT_CORPUS_ID;
}
