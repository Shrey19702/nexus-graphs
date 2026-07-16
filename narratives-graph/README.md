# Narratives Graph

Interactive Canvas + D3 force layout: **narrative** → **topic** → **posts**.

Data: `graph2_pillar_topic.json` (JSON still uses `pillar_node`; the app maps those to narratives) + `all-nexus-data-till-15jul.csv`.

## Quick start

```bash
./run.sh
```

Open [http://localhost:8000/narratives-graph/](http://localhost:8000/narratives-graph/).

## Overview

Chrome → **Overview** opens a corpus summary: narrative/topic/post counts, global sentiment mix, and per-narrative cards (topics, posts, sentiment bar). Click a sentiment label to highlight matching posts on the graph (same as narrative/topic panels). Click a card to open that narrative.

## Settings

- **Post sentiments** — uncheck a stance to hide it everywhere (graph, distribution bars, labels, post lists). Default shows anti/pro government & CJP plus Neutral/news.
- **Show empty narratives** — narratives with no topics are hidden by default.
- **Show topics with no posts** — topics with zero linked posts are hidden by default.
- **Node sizes** — defaults: Narrative 50, Topic 15, Post 3.
- **Reverse sentiment order** — flips list/packing sort order (panel control is a compact Reverse button).
