# Themes Graph

Interactive Canvas + D3 force layout: **theme** → **topic** → **posts**.

Data paths live in [`../shared/nexus-data.yml`](../shared/nexus-data.yml) (`csv` + `graph`). Current dumps: `graph2_parent_topic_topic_24_07.json` (`parent_topic_node` / legacy `pillar_node` map to themes) + `CJP_Master_Nexus_Input_24_July.csv`.

Append new moderation batches with `python3 append_nexus_data.py --csv path/to/new.csv`.

## Layout

- `js/main.js` — ES module entry
- `js/app.js` — themes domain logic
- `../shared/js/` — theme palette, CSV, canvas, forces, panel primitives shared with platform-profiles

## Quick start

```bash
./run.sh
```

Open [http://localhost:8000/narratives-graph/](http://localhost:8000/narratives-graph/).

## Overview

Chrome → **Overview** opens a corpus summary: theme/topic/post counts, global sentiment mix, and per-theme cards (topics, posts, sentiment bar). Click a sentiment label to highlight matching posts on the graph (same as theme/topic panels). Click a card to open that theme.

## Settings

- **Post sentiments** — uncheck a stance to hide it everywhere (graph, distribution bars, labels, post lists). Default shows anti/pro government & CJP plus Neutral/news.
- **Show empty themes** — themes with no topics are hidden by default.
- **Show topics with no posts** — topics with zero linked posts are hidden by default.
- **Node sizes** — defaults: Theme 50, Topic 15, Post 3.
- **Reverse sentiment order** — flips list/packing sort order (panel control is a compact Reverse button).
