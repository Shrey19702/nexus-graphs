#!/usr/bin/env node
/**
 * Run the live narratives-graph simulation, then capture canvas PNGs for the
 * report overview + each theme (stance colors on) into images/<corpus>/.
 *
 * Usage (from repo root):
 *   npm i
 *   npx playwright install chromium
 *   npm run generate-report-images              # all hubs
 *   npm run generate-report-images -- stk       # one hub
 *   npm run generate-report-images -- stk dnp   # several
 *   npm run generate-report-images -- --list
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  CORPUS_ORDER,
  getCorpus,
  listCorpora,
} from "../shared/js/corpora.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.NEXUS_PORT || 8000);
const BASE = `http://127.0.0.1:${PORT}`;
const SETTLE_TIMEOUT_MS = Number(process.env.NEXUS_SETTLE_TIMEOUT_MS || 90_000);
const ZOOM_WAIT_MS = Number(process.env.NEXUS_ZOOM_WAIT_MS || 550);
const YAML_PATH = path.join(ROOT, "shared", "nexus-data.yml");
const IMAGES_ROOT = path.join(ROOT, "images");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugifyTheme(name) {
  return (
    String(name)
      .normalize("NFKD")
      .replace(/['']/g, "")
      .replace(/&/g, "and")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "theme"
  );
}

function printHelp() {
  const ids = CORPUS_ORDER.join(", ");
  console.log(`Capture report PNGs per hub into images/<corpus>/.

Usage:
  npm run generate-report-images                 all hubs (${ids})
  npm run generate-report-images -- <id>…        one or more hubs
  npm run generate-report-images -- --corpus=stk,ap
  npm run generate-report-images -- --list
  npm run generate-report-images -- --help
`);
}

function parseArgs(argv) {
  const raw = argv.slice(2);
  if (raw.includes("-h") || raw.includes("--help")) return { help: true };

  const ids = [];
  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    if (!arg || arg === "--") continue;
    if (arg === "--list") return { list: true };
    if (arg === "--corpus" || arg === "-c") {
      const next = raw[++i];
      if (!next) throw new Error("Missing value for --corpus");
      ids.push(...next.split(/[, ]+/).filter(Boolean));
      continue;
    }
    if (arg.startsWith("--corpus=")) {
      ids.push(...arg.slice("--corpus=".length).split(/[, ]+/).filter(Boolean));
      continue;
    }
    if (arg.startsWith("-")) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    ids.push(...arg.split(",").filter(Boolean));
  }

  if (!ids.length) {
    return { corpora: CORPUS_ORDER.map((id) => getCorpus(id)).filter(Boolean) };
  }

  const corpora = [];
  const seen = new Set();
  for (const rawId of ids) {
    const corpus = getCorpus(rawId);
    if (!corpus) {
      const known = CORPUS_ORDER.join(", ");
      throw new Error(`Unknown hub "${rawId}". Known: ${known}`);
    }
    if (seen.has(corpus.id)) continue;
    seen.add(corpus.id);
    corpora.push(corpus);
  }
  return { corpora };
}

async function readManifest(dir) {
  const file = path.join(dir, "theme-images.json");
  try {
    const raw = JSON.parse(await readFile(file, "utf8"));
    const themes =
      raw?.themes && typeof raw.themes === "object" && !Array.isArray(raw.themes)
        ? { ...raw.themes }
        : {};
    return {
      overview: raw?.overview || "narrative-graph.png",
      themes,
      version: raw?.version ? String(raw.version) : "",
    };
  } catch {
    return { overview: "narrative-graph.png", themes: {}, version: "" };
  }
}

async function writeManifest(dir, manifest) {
  const body = {
    overview: manifest.overview || "narrative-graph.png",
    version: String(manifest.version || ""),
    themes: manifest.themes || {},
  };
  await writeFile(
    path.join(dir, "theme-images.json"),
    `${JSON.stringify(body, null, 2)}\n`,
    "utf8"
  );
}

async function patchYamlImagesVersion(version) {
  let text = await readFile(YAML_PATH, "utf8");
  if (/^images_version:\s*.+$/m.test(text)) {
    text = text.replace(/^images_version:\s*.+$/m, `images_version: "${version}"`);
  } else {
    text = `${text.trimEnd()}\nimages_version: "${version}"\n`;
  }
  await writeFile(YAML_PATH, text, "utf8");
}

async function portOpen(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function ensureServer() {
  const free = await portOpen(PORT);
  if (!free) {
    console.log(`Using existing server on ${BASE}`);
    return null;
  }
  console.log(`Starting python3 -m http.server ${PORT} …`);
  const child = spawn("python3", ["-m", "http.server", String(PORT)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let booted = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${BASE}/shared/nexus-data.yml`);
      if (res.ok) {
        booted = true;
        break;
      }
    } catch {
      /* retry */
    }
    await sleep(150);
  }
  if (!booted) {
    child.kill("SIGTERM");
    throw new Error(`Server did not become ready on ${BASE}`);
  }
  return child;
}

function dataUrlToBuffer(dataUrl) {
  const m = String(dataUrl).match(/^data:image\/png;base64,(.+)$/);
  if (!m) throw new Error("Expected PNG data URL from canvas capture");
  return Buffer.from(m[1], "base64");
}

async function waitForCapture(page) {
  await page.waitForFunction(
    () => window.__nexusCapture && window.__nexusCapture.ready,
    null,
    { timeout: SETTLE_TIMEOUT_MS }
  );
  await page.waitForFunction(
    () => window.__nexusCapture && window.__nexusCapture.settled,
    null,
    { timeout: SETTLE_TIMEOUT_MS }
  );
}

async function capturePng(page) {
  const dataUrl = await page.evaluate(() => window.__nexusCapture.toPngDataUrl());
  return dataUrlToBuffer(dataUrl);
}

function uniqueFilename(base, usedFiles) {
  let candidate = base;
  let n = 2;
  while (usedFiles.has(candidate)) {
    candidate = base.replace(/\.png$/i, `_${n}.png`);
    n += 1;
  }
  return candidate;
}

async function captureCorpus(page, corpus) {
  const imagesDir = path.join(ROOT, corpus.images_base || `images/${corpus.id}/`);
  const overviewFile = corpus.overview_image || "narrative-graph.png";
  await mkdir(imagesDir, { recursive: true });

  const prev = await readManifest(imagesDir);
  const themeMap = prev.themes;
  const usedFiles = new Set(Object.values(themeMap));
  usedFiles.add(overviewFile);

  const url = `${BASE}/narratives-graph/?corpus=${encodeURIComponent(corpus.id)}`;
  console.log(`\n[${corpus.label}] Loading ${url}`);
  await page.goto(url, {
    waitUntil: "networkidle",
    timeout: SETTLE_TIMEOUT_MS,
  });

  console.log(`[${corpus.label}] Waiting for simulation to settle …`);
  await waitForCapture(page);

  const written = [];
  console.log(`[${corpus.label}] Capturing overview → ${overviewFile}`);
  await page.evaluate(() => window.__nexusCapture.fitOverview());
  await sleep(ZOOM_WAIT_MS);
  await writeFile(path.join(imagesDir, overviewFile), await capturePng(page));
  written.push(overviewFile);

  const themes = await page.evaluate(() => window.__nexusCapture.listThemes());
  console.log(`[${corpus.label}] Capturing ${themes.length} theme(s) …`);

  const nextMap = {};
  for (const theme of themes) {
    let filename = themeMap[theme];
    if (!filename) {
      filename = uniqueFilename(`${slugifyTheme(theme)}.png`, usedFiles);
      console.log(`  + new theme map: "${theme}" → ${filename}`);
    }
    usedFiles.add(filename);
    nextMap[theme] = filename;

    console.log(`  ${theme} → ${filename}`);
    await page.evaluate((name) => window.__nexusCapture.focusTheme(name), theme);
    await sleep(ZOOM_WAIT_MS);
    await writeFile(path.join(imagesDir, filename), await capturePng(page));
    written.push(filename);
  }

  const version = String(Date.now());
  await writeManifest(imagesDir, {
    overview: overviewFile,
    version,
    themes: nextMap,
  });

  const relDir = path.relative(ROOT, imagesDir);
  console.log(`[${corpus.label}] Wrote ${path.join(relDir, "theme-images.json")} (v=${version})`);
  for (const f of written) console.log(`  ${path.join(relDir, f)}`);
  return written.length;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (args.list) {
    for (const corpus of listCorpora()) {
      console.log(`${corpus.id}\t${corpus.label}\t${corpus.images_base}`);
    }
    return;
  }

  const corpora = args.corpora;
  if (!corpora.length) {
    throw new Error("No hubs to capture");
  }
  console.log(
    `Hubs: ${corpora.map((c) => c.id).join(", ")}  (images under ${path.relative(ROOT, IMAGES_ROOT)}/<id>/)`
  );

  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  let pngCount = 0;

  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });

    for (const corpus of corpora) {
      try {
        pngCount += await captureCorpus(page, corpus);
      } catch (err) {
        failures.push(corpus.id);
        console.error(`[${corpus.label}] FAILED:`, err?.message || err);
      }
    }

    if (!failures.length) {
      const imagesVersion = String(Date.now());
      await patchYamlImagesVersion(imagesVersion);
      console.log(`\nSet shared images_version=${imagesVersion} (fallback cache bust)`);
    }
  } finally {
    await browser.close();
    if (server) server.kill("SIGTERM");
  }

  if (failures.length) {
    throw new Error(
      `Image capture failed for: ${failures.join(", ")} (${pngCount} PNG(s) from the rest)`
    );
  }
  console.log(`\nDone (${pngCount} PNG(s) across ${corpora.length} hub(s)).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
