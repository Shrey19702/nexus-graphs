# Nexus Report

Print-ready HTML report built from the narratives graph CSV + parent/topic graph.

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

| File | Role |
|------|------|
| `../narratives-graph/CJP_Master_Nexus_Input_22_July.csv` | Posts, stance, `posted_at`, parent/topic |
| `../narratives-graph/graph2_parent_topic_topic_22_07.json` | Canonical parent topic order |
| `../images/narrative-graph.png` | Cover overview image |
| `../images/*.png` | Per–parent-topic images |

## Report contents

1. **THE NEXUS** — overview image, total posts, parent topic list, overall sentiment.
2. **One section per parent topic** — image, sentiment bars, internal topic list, and a stacked daily timeline chart per internal topic (x = date, y = post count, bar segments = stance).
