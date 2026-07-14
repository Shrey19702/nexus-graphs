# Platform Profiles Graph

Interactive Canvas + D3 force layout for **platforms** as hubs and **profiles** as orbiting nodes.

Based on the topic-graph visualizer, adapted for a two-level platform model (no `mega_mega_node`).

## Quick start

Serve the **repo root** (or this folder) over HTTP:

```bash
cd /Users/tempus/Desktop/overwatch/nexus_test
python3 -m http.server
```

Open [http://localhost:8000/platform-profiles/](http://localhost:8000/platform-profiles/).

## Graph model

| Type | Meaning | Visual |
|------|---------|--------|
| `mega_node` | Platform hub (X, Instagram, Facebook, …) | Large labeled circle; drag moves the whole cluster |
| `regular_node` | Profile | Smaller circle colored by `category` |

There are **no** `mega_mega_node`s in this graph.

### Edges & distance

Each link is `platform → profile` and carries a numeric `distance`:

| Distance | Typical category | Layout |
|----------|------------------|--------|
| `1` | hub | Innermost ring |
| `2` | promoter | Middle ring |
| `3` | general | Outer ring |

`distance` drives:

1. Seed placement on concentric rings (with packing lanes when a ring is overcrowded)
2. Soft `forceLink` spring toward each profile’s lane
3. Soft radial spring + hard clamp to the JSON distance band — profiles can stagger within the band to avoid overlap, without jumping to another distance class

Dense rings (e.g. 69 generals) are split across a few close lanes inside the band, then sibling overlap is resolved with mostly-shear pushes.

### Categories

| Category | Color role |
|----------|------------|
| `hub` | Warm accent (closest / most central) |
| `promoter` | Mid green-grey |
| `general` | Cool slate |

## Interaction

| Action | Behavior |
|--------|----------|
| Scroll | Zoom |
| Drag empty canvas | Pan |
| Drag platform | Moves platform + all linked profiles; anchors platform on drop |
| Click platform | Panel with category / distance breakdown + profile list; shows orbit guides |
| Click profile | Panel with handle, URL, category, distance, platform |
| Escape / empty click / × | Close panel |

## Files

| File | Role |
|------|------|
| `index.html` | Shell |
| `styles.css` | Shared chrome / panel styles |
| `app.js` | Load, seed, forces, Canvas render, interaction |
| `x_profiles_graph.json` | Platform → profile graph |
| `CJP-SEARCH-RESULTS - l1-iteration-1-sentiment.csv` | Sentiment sheet with `profile_url` (posts join to profiles) |

### Posts & sentiment

Sentiment CSV is the primary sheet; `profile_url` was merged in from the all-results sheet (empty when missing). Posts attach to profiles by normalized `profile_url` ↔ profile node id.

Click a profile to see stance distribution + post list (same pattern as topic-graph narratives). Linked posts also appear as stance-colored satellites around the profile; click a satellite for full sentiment detail.

## Tunables (`app.js`)

| Constant | Role |
|----------|------|
| `DISTANCE_UNIT` / `DISTANCE_BASE` | Ring spacing from link `distance` |
| `CLUSTER_PITCH` | Spacing between platform hubs when there are several |
| `PLATFORM_REPEL` | Platforms push apart |
| `DISTANCE_RING_FORCE` | How strongly profiles stick to their distance ring |
| `LABEL_ZOOM_MULT` | Zoom level at which profile labels appear |
