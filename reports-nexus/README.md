# Nexus Report

Print-ready HTML report built from the selected hub’s CSV + theme/topic graph.

## Open locally

From the repo root:

```bash
python3 -m http.server
# or: ./run.sh
```

Then open [http://localhost:8000/reports-nexus/?corpus=stk](http://localhost:8000/reports-nexus/?corpus=stk) (or pick a hub on `/`).

## Export PDF

1. Wait until the status says the report is ready.
2. Click **Export PDF** (or use the browser print dialog).
3. Choose **Save as PDF**.
4. Enable background graphics / print backgrounds so sentiment colors appear.

## Inputs

Dataset paths are per hub in [`shared/js/corpora.js`](../shared/js/corpora.js) (`csv`, `graph`, `images_base`). Hub tabs / `?corpus=` select which entry is used.

| File | Role |
|------|------|
| `corpora.js` → `csv` | Posts, stance, optional `posted_at` / platform, theme/topic |
| `corpora.js` → `graph` | Canonical theme order |
| `images/<corpus>/narrative-graph.png` | Cover overview image |
| `images/<corpus>/*.png` | Per-theme images |
| `images/<corpus>/theme-images.json` | Theme name → PNG map + cache-bust version |

Each hub has its own folder (`images/cjp/`, `images/ap/`, `images/stk/`, `images/dnp/`) so regenerating one hub does not overwrite another.

### Regenerate graph images

After swapping CSV/graph (or when themes change), capture overview + per-theme PNGs from the live narratives-graph simulation:

```bash
npm i
npx playwright install chromium
npm run generate-report-images              # all hubs
npm run generate-report-images -- stk       # one hub
npm run generate-report-images -- stk dnp   # several
npm run generate-report-images -- --list
```

This writes into `images/<corpus>/`, updates that hub’s `theme-images.json`, and bumps a per-hub `version` so the report does not show stale cached PNGs.

## Report contents

1. **THE NEXUS** — overview image, total posts, themes list, overall sentiment, overall timeline, platform donut.
2. **One section per theme** — image, sentiment bars, compact multi-column internal topics list, and one stacked daily timeline for the theme.
