/** Load corpus config (hub tabs / ?corpus=) and resolve paths from the repo root. */

import {
  getCorpus,
  resolveCorpusId,
  rememberCorpus,
  DEFAULT_CORPUS_ID,
} from "./corpora.js?v=2026-08-26-hub-images";

/**
 * Minimal YAML subset: `key: value` lines + `#` comments.
 * Kept for optional overrides in shared/nexus-data.yml.
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseSimpleYaml(text) {
  const out = Object.create(null);
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

/** Turn a repo-root-relative path into a site-absolute URL. */
export function resolveRepoPath(pathFromRoot) {
  const clean = String(pathFromRoot || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
  return clean ? `/${clean}` : "/";
}

/**
 * @returns {Promise<{
 *   corpusId: string,
 *   corpusLabel: string,
 *   corpusTitle: string,
 *   csv: string,
 *   graph: string,
 *   images_base: string,
 *   overview_image: string,
 *   images_version: string,
 *   themeImages: Record<string, string>,
 *   timeline_start: string,
 *   hasPostedAt: boolean,
 *   hasPlatform: boolean,
 *   csvUrl: string,
 *   graphUrl: string,
 *   imagesBaseUrl: string,
 * }>}
 */
export async function loadNexusDataConfig() {
  const corpusId = resolveCorpusId();
  const corpus = getCorpus(corpusId) || getCorpus(DEFAULT_CORPUS_ID);
  rememberCorpus(corpus.id);

  let images_version = "";
  try {
    const res = await fetch(`/shared/nexus-data.yml?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const raw = parseSimpleYaml(await res.text());
      if (raw.images_version) images_version = raw.images_version;
    }
  } catch {
    /* yml optional when using corpora registry */
  }

  const images_base = corpus.images_base || `images/${corpus.id}/`;
  let overview_image = corpus.overview_image || "narrative-graph.png";
  const timeline_start = corpus.timeline_start || "2026-07-01";
  const imagesBaseUrl = resolveRepoPath(images_base).replace(/\/?$/, "/");
  let themeImages = Object.create(null);

  try {
    const res = await fetch(`${imagesBaseUrl}theme-images.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.themes && typeof json.themes === "object" && !Array.isArray(json.themes)) {
        themeImages = { ...json.themes };
      }
      if (json?.overview) overview_image = json.overview;
      if (json?.version) images_version = String(json.version);
      const hasImages =
        Boolean(json?.version) || Object.keys(themeImages).length > 0;
      if (!hasImages) overview_image = "";
    }
  } catch {
    /* optional until generate-report-images has been run for this hub */
  }

  return {
    corpusId: corpus.id,
    corpusLabel: corpus.label,
    corpusTitle: corpus.title,
    csv: corpus.csv,
    graph: corpus.graph,
    images_base,
    overview_image,
    images_version,
    timeline_start,
    hasPostedAt: Boolean(corpus.hasPostedAt),
    hasPlatform: Boolean(corpus.hasPlatform),
    csvUrl: resolveRepoPath(corpus.csv),
    graphUrl: resolveRepoPath(corpus.graph),
    imagesBaseUrl,
    themeImages,
  };
}
