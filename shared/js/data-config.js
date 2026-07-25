/** Load shared/nexus-data.yml and resolve paths from the repo root. */

const CONFIG_URL = "/shared/nexus-data.yml";

/**
 * Minimal YAML subset: `key: value` lines + `#` comments.
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
 *   csv: string,
 *   graph: string,
 *   images_base: string,
 *   overview_image: string,
 *   timeline_start: string,
 *   csvUrl: string,
 *   graphUrl: string,
 *   imagesBaseUrl: string,
 * }>}
 */
export async function loadNexusDataConfig() {
  const res = await fetch(`${CONFIG_URL}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ${CONFIG_URL} (${res.status})`);
  }
  const raw = parseSimpleYaml(await res.text());
  const csv = raw.csv;
  const graph = raw.graph;
  if (!csv || !graph) {
    throw new Error(`${CONFIG_URL} must define csv and graph paths`);
  }

  const images_base = raw.images_base || "images/";
  const overview_image = raw.overview_image || "narrative-graph.png";
  const timeline_start = raw.timeline_start || "2026-07-01";

  const imagesBaseUrl = resolveRepoPath(images_base).replace(/\/?$/, "/");

  return {
    csv,
    graph,
    images_base,
    overview_image,
    timeline_start,
    csvUrl: resolveRepoPath(csv),
    graphUrl: resolveRepoPath(graph),
    imagesBaseUrl,
  };
}
