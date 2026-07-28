# Nexus Report

Print-ready HTML report built from the theme graph CSV + theme/topic graph.

## Open locally

From the repo root:

```bash
python3 -m http.server
# or: ./run.sh
```

Then open [http://localhost:8000/reports-nexus/](http://localhost:8000/reports-nexus/).

## Export PDF

1. Wait until the status says the report is ready.
2. Click **Export PDF** (or use the browser print dialog).
3. Choose **Save as PDF**.
4. Enable background graphics / print backgrounds so sentiment colors appear.

## Inputs

Edit [`shared/nexus-data.yml`](../shared/nexus-data.yml) to point at the current CSV / graph files (paths are relative to the repo root):

```yaml
csv: narratives-graph/CJP_Master_Nexus_Input_23_July.csv
graph: narratives-graph/graph2_parent_topic_topic_23_07.json
images_base: images/
overview_image: narrative-graph.png
timeline_start: "2026-07-01"
```

| File | Role |
|------|------|
| Path in `shared/nexus-data.yml` → `csv` | Posts, stance, `posted_at`, platform, theme/topic |
| Path in `shared/nexus-data.yml` → `graph` | Canonical theme order |
| `images/narrative-graph.png` | Cover overview image |
| `images/*.png` | Per-theme images |

## Report contents

1. **THE NEXUS** — overview image, total posts, themes list, overall sentiment, overall timeline, platform donut.
2. **One section per theme** — image, sentiment bars, compact multi-column internal topics list, and one stacked daily timeline for the theme.
