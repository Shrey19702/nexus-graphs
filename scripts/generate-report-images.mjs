#!/usr/bin/env node
/**
 * Run the live narratives-graph simulation, then capture canvas PNGs for the
 * report overview + each theme (stance colors on) into images/.
 *
 * Usage (from repo root):
 *   npm i
 *   npx playwright install chromium
 *   npm run generate-report-images
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.NEXUS_PORT || 8000);
const BASE = `http://127.0.0.1:${PORT}`;
const SETTLE_TIMEOUT_MS = Number(process.env.NEXUS_SETTLE_TIMEOUT_MS || 90_000);
const ZOOM_WAIT_MS = Number(process.env.NEXUS_ZOOM_WAIT_MS || 550);

const YAML_PATH = path.join(ROOT, "shared", "nexus-data.yml");
const CONSTANTS_PATH = path.join(ROOT, "reports-nexus", "js", "constants.js");
const IMAGES_DIR = path.join(ROOT, "images");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseSimpleYaml(text) {
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

function parseThemeImageMap(source) {
  const match = source.match(/export const THEME_IMAGE = \{([\s\S]*?)\n\};/);
  if (!match) throw new Error("Could not find THEME_IMAGE in constants.js");
  const map = Object.create(null);
  const re = /"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(match[1]))) {
    map[JSON.parse(`"${m[1]}"`)] = JSON.parse(`"${m[2]}"`);
  }
  return map;
}

function formatThemeImageMap(map) {
  const lines = Object.entries(map).map(([theme, file]) => {
    const key = JSON.stringify(theme);
    const val = JSON.stringify(file);
    if (key.length + val.length > 70) {
      return `  ${key}:\n    ${val},`;
    }
    return `  ${key}: ${val},`;
  });
  return `export const THEME_IMAGE = {\n${lines.join("\n")}\n};\n`;
}

async function patchThemeImageMap(map) {
  const source = await readFile(CONSTANTS_PATH, "utf8");
  if (!/export const THEME_IMAGE = \{[\s\S]*?\n\};/.test(source)) {
    throw new Error("Could not patch THEME_IMAGE in constants.js");
  }
  const next = source.replace(
    /export const THEME_IMAGE = \{[\s\S]*?\n\};/,
    formatThemeImageMap(map).trimEnd()
  );
  await writeFile(CONSTANTS_PATH, next, "utf8");
}

/** Bump images_version in nexus-data.yml so the report busts browser image cache. */
async function patchImagesVersion(version) {
  let text = await readFile(YAML_PATH, "utf8");
  if (/^images_version:\s*.+$/m.test(text)) {
    text = text.replace(/^images_version:\s*.+$/m, `images_version: "${version}"`);
  } else {
    const line = `images_version: "${version}"`;
    if (/^overview_image:\s*.+$/m.test(text)) {
      text = text.replace(/^(overview_image:\s*.+)$/m, `$1\n${line}`);
    } else {
      text = `${text.trimEnd()}\n${line}\n`;
    }
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
    await new Promise((r) => setTimeout(r, 150));
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

async function main() {
  const yaml = parseSimpleYaml(await readFile(YAML_PATH, "utf8"));
  const imagesBase = (yaml.images_base || "images/").replace(/\/?$/, "/");
  const overviewFile = yaml.overview_image || "narrative-graph.png";
  if (!imagesBase.startsWith("images")) {
    console.warn(`images_base is "${imagesBase}" — writing under repo images/ anyway`);
  }

  await mkdir(IMAGES_DIR, { recursive: true });

  let themeMap = parseThemeImageMap(await readFile(CONSTANTS_PATH, "utf8"));
  const usedFiles = new Set(Object.values(themeMap));

  const server = await ensureServer();
  const browser = await chromium.launch({ headless: true });
  const written = [];

  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });

    console.log("Loading narratives-graph …");
    await page.goto(`${BASE}/narratives-graph/`, {
      waitUntil: "networkidle",
      timeout: SETTLE_TIMEOUT_MS,
    });

    console.log("Waiting for simulation to settle …");
    await waitForCapture(page);

    console.log(`Capturing overview → ${overviewFile}`);
    await page.evaluate(() => window.__nexusCapture.fitOverview());
    await sleep(ZOOM_WAIT_MS);
    await writeFile(path.join(IMAGES_DIR, overviewFile), await capturePng(page));
    written.push(overviewFile);

    const themes = await page.evaluate(() => window.__nexusCapture.listThemes());
    console.log(`Capturing ${themes.length} theme(s) …`);

    const nextMap = Object.create(null);
    for (const theme of themes) {
      let filename = themeMap[theme];
      if (!filename) {
        let base = `${slugifyTheme(theme)}.png`;
        let candidate = base;
        let n = 2;
        while (usedFiles.has(candidate)) {
          candidate = base.replace(/\.png$/i, `_${n}.png`);
          n += 1;
        }
        filename = candidate;
        console.log(`  + new theme map: "${theme}" → ${filename}`);
      }
      usedFiles.add(filename);
      nextMap[theme] = filename;

      console.log(`  ${theme} → ${filename}`);
      await page.evaluate((name) => window.__nexusCapture.focusTheme(name), theme);
      await sleep(ZOOM_WAIT_MS);
      await writeFile(path.join(IMAGES_DIR, filename), await capturePng(page));
      written.push(filename);
    }

    themeMap = nextMap;
    await patchThemeImageMap(themeMap);
    const imagesVersion = String(Date.now());
    await patchImagesVersion(imagesVersion);
    console.log(`Updated THEME_IMAGE in ${path.relative(ROOT, CONSTANTS_PATH)}`);
    console.log(`Set images_version=${imagesVersion} (report cache bust)`);

    console.log("\nWrote:");
    for (const f of written) console.log(`  images/${f}`);
    console.log(`Done (${written.length} PNG(s)).`);
  } finally {
    await browser.close();
    if (server) {
      server.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
