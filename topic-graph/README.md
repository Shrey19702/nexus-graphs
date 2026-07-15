# Subtopic Graph

Interactive Canvas + D3 force layout for hierarchical topic graphs: **parent topics** (`mega_mega_node`) → **narratives** (`mega_node`) → **posts** (`regular_node`).

## Quick start

Serve the **repo root** (or this folder) over HTTP:

```bash
cd /Users/tempus/Desktop/overwatch/nexus_test
python3 -m http.server
```

Open [http://localhost:8000/topic-graph/](http://localhost:8000/topic-graph/).

A local HTTP server is required because the app `fetch`es the graph JSON (browsers block `file://` fetches).

Optional: `./run.sh` from the repo root.

## Project files

| File | Role |
|------|------|
| `index.html` | Shell page: fullscreen canvas, chrome (title + zoom %), detail side panel (post or narrative) |
| `styles.css` | Layout chrome, panel, off-white page background |
| `app.js` | Data load, seeding, forces, Canvas render, zoom / hover / click / drag |
| `15jul-narrative-graph.json` | **Active** dataset (3-level hierarchy; 14jul + 15jul posts) |
| `all-nexus-data-till-15jul.csv` | **Active** post detail / sentiment sheet (joined by `post_id` ↔ node `id`) |
| `README.md` | This document |

Canonical sources at repo root:

- [`../14jul-nexus-data-with-stance.csv`](../14jul-nexus-data-with-stance.csv)
- [`../15jul-nexus-data.csv`](../15jul-nexus-data.csv)
- [`../15jul-narrative-graph.json`](../15jul-narrative-graph.json)

Superseded sheets / earlier graphs: [`../old-data/`](../old-data/) (gitignored).

See also [`../platform-profiles/`](../platform-profiles/) for the platform → profile graph.

Active data path is set in `app.js` as:

```js
const DATA_FILE = "15jul-narrative-graph.json";
```

## Graph model

### Node types

| Type | Meaning | Visual |
|------|---------|--------|
| `mega_mega_node` | Parent topic / top-level cluster hub | Largest circles; dull family color; black labels when zoomed in |
| `mega_node` | Narrative / subtopic | Medium circles; **same color as parent topic** |
| `regular_node` | Post / leaf content | Small dots; lightened tint of parent narrative color |

### Edge kinds

| Kind | Connects | Behavior |
|------|----------|----------|
| `parent_link` | `mega_mega_node` ↔ `mega_node` | Medium-short spring (`PARENT_LINK_GAP`) |
| `post_link` | `mega_node` ↔ `regular_node` | Render-only relationship; local post packing replaces per-post springs |

### Identity (important)

Source JSON sometimes reuses the **same string `id`** for both a parent topic and a narrative (and may include self-links `A → A` meaning parent→child of that title).

The loader:

1. Keeps **every** node record (no merge by string id).
2. Assigns a fresh unique numeric `id` (`0 … n-1`) used by D3.
3. Stores the original string as `rawId` (shown in UI / labels).
4. Remaps links with type-aware resolution:
   - Self-link → `mega_mega_node` → `mega_node` of that title
   - Target prefers `regular_node` → `mega_node` → `mega_mega_node`
   - Source chooses the appropriate parent type for that target

After remapping you should see clean hierarchy edges only (parent→narrative and narrative→post).

## Features

### Layout

The graph uses a two-level hybrid layout:

1. **Structural simulation (~411 nodes)**
   - Only parent topics and narratives participate in D3 physics.
   - Parent topics are seeded in a size-aware golden-angle pack and act as the **sole attractor** for their narratives.
   - A one-way parent attract force keeps narratives orbiting their hub; children never pull parents off center.
   - Family repulsion / collision move each parent **with** its narratives so topic-topic gaps stay stable.
   - Narrative↔narrative collision uses each topic's farthest packed post centre as radius.
   - Posts and post links are excluded from the simulation.
2. **Local post clouds (~5,088 posts)**
   - Posts occupy a collision-free hex lattice around their narrative; angular assignment keeps stances in contiguous sectors.
   - Each post stores a local offset; its world position is derived from the narrative position.
   - Changed post layouts interpolate toward new local targets and stop when settled.
   - A narrative's structural collision radius is its farthest packed post centre, so post clouds reserve their visible space without simulating every post.
3. **Settle**
   - Parent topics and narratives are pinned when the structural simulation ends.
   - Idle physics cost is zero.
   - The view fits once after the initial simulation; anchor micro-settles do not move the camera.

### Colors (family tinting)

Each `mega_mega_node` gets a color from `FAMILY_PALETTE` (dull slate/taupe/sage tones). All of its `mega_node` children inherit that fill. Posts get a lightened version of the narrative’s family color. Links are tinted with the same family at low alpha.

Orphaned narratives (no parent topic) use `COLORS.orphan`.

### Labels & clutter control

- **Parent topic labels** (`mega_mega_node`) and **narrative labels** draw only when zoom ≥ `baselineZoom * LABEL_ZOOM_MULT` (default ~450% of fit zoom). Overlapping labels are skipped via screen-space collision. Truncated with ellipsis.
- **Post labels** never draw on the canvas at rest; hover shows a tooltip; click opens the panel.
- **All text is black** (chrome, panel, graph labels, tooltip text). Tooltips use a light background so black text stays readable.

### Interaction

| Action | Behavior |
|--------|----------|
| Scroll wheel | Zoom toward cursor (`d3.zoom`, scale extent `0.02–12`) |
| Drag empty canvas | Pan |
| Hover post / mega / parent | Outline / tooltip with full display name |
| Click post | Opens right **detail panel** with CSV sentiment fields when `post_id` matches (sentiment, content, reasoning, URL, …) |
| **Click narrative (`mega_node`)** | Opens panel with sentiment **distribution bar + %**, post list; **highlights** posts with **sentiment-colored borders**; focuses camera. Same-sentiment posts are clustered around the narrative. |
| Click empty / other / Escape / panel × | Closes panel; clears highlight |
| **Drag `mega_mega_node`** | Moves the parent **and** its linked narratives + posts as one cluster; on release the parent is **anchored** (`userPinned`) at that position. A dashed black ring marks anchored parents. |

Dragging a parent topic suppresses pan/zoom on that gesture. The family moves as a rigid structural unit and posts follow through their local offsets. On drop:

- If the new family footprint does not overlap another family, no simulation restarts.
- If it overlaps, only the dragged family plus directly overlapping, non-user-anchored neighbors receive a short low-alpha structural settle.
- Previously user-anchored families remain fixed.

### Side panel fields

**Post mode**

- **Post ID** — original string `rawId` (matched to CSV `post_id`)
- **Sentiment / tone / content / post narrative / subjects / violations / URL** — from `all-nexus-data-till-15jul.csv` when present
- **Details** — platform, speech type, severity, parent topic / topic, keyword, protected expression, …
- **Narrative** — linked `mega_node` title(s) and parent topic name(s)

**Narrative (`mega_node`) mode**

- **Narrative ID** / **Label** / **Parent topic**
- **Sentiment distribution** — stacked percentage bar + counts (`post_count` / `percentage` per sentiment); click a row to filter
- **Posts** — sentiment-sorted list (click a card to open that post)

## Settings reference (`app.js`)

Tune these constants near the top of `app.js`, then hard-refresh.

### Visual / size

| Constant | Default | Meaning |
|----------|---------|---------|
| `POST_R` | `3` | Post circle radius (world units) |
| `MEGA_R_MIN` / `MEGA_R_MAX` | `12` / `22` | Narrative radius range (scales with degree) |
| `MEGA_MEGA_R_MIN` / `MEGA_MEGA_R_MAX` | `28` / `42` | Parent topic radius range |
| `LINK_GAP` | `1.5` | Gap between a narrative disc and the first local post lane |
| `PARENT_LINK_GAP` | `6` | Extra parent↔narrative distance beyond the narrative post-cloud collision radius |
| `CLUSTER_PITCH` | `220` | Minimum scale used by size-aware parent seeding |
| `CLUSTER_PACK_PAD` | `36` | Padding added to aggregate family footprints |
| `LABEL_ZOOM_MULT` | `4.5` | Narrative + parent-topic labels appear at this multiple of fit zoom; overlapping labels are skipped |
| `MEGA_MEGA_LABEL_SIZE` | `10` | Parent-topic label font size in world units (scales with zoom on screen) |
| `MEGA_LABEL_MAX_CHARS` | `22` | Max narrative label chars on-canvas |
| `MEGA_MEGA_LABEL_MAX_CHARS` | `26` | Max parent topic label chars on-canvas |
| `FAMILY_PALETTE` | 13 dull hex colors | Rotating colors for parent topics |

### Forces / clustering

| Constant | Default | Meaning |
|----------|---------|---------|
| `MEGA_MEGA_REPEL` | `220` | Parent-topic many-body strength magnitude |
| `MEGA_MEGA_REPEL_DIST` | `280` | Max distance for parent many-body |
| `FOREIGN_MEGA_REPEL` | `32` | Strength of cross-family narrative push |
| `FOREIGN_MEGA_DIST_MAX` | `120` | Range of foreign narrative repel |
| `FAMILY_COLLIDE_PAD` | `28` | Extra separation between aggregate family footprints |
| `TOPIC_COLLIDE_PAD` | `6` | Gap after parent-topic/narrative collision radii |
| Initial simulation alpha / minimum / decay | `0.92` / `0.002` / `0.018` | Longer initial settle for the full graph; anchor repairs use their separate short settle |
| `LOCAL_SETTLE_ALPHA` | `0.14` | Energy for overlap-only anchor settling |
| `POST_LERP` | `0.24` | Per-frame local post interpolation factor |
| Collide `iterations` | `2` | Keep low for performance |
| Parent attract strength | `0.95` | How tightly narratives orbit their parent hub (one-way) |

### Interaction

| Constant | Default | Meaning |
|----------|---------|---------|
| `CLICK_MOVE_PX` | `5` | Pointer movement below this counts as click (not drag) |
| Zoom `scaleExtent` | `[0.02, 12]` | Min/max absolute zoom `k` |

### Colors object

| Key | Role |
|-----|------|
| `bg` | Canvas clear / page off-white |
| `text` / `tooltipText` | Black UI + graph text |
| `tooltipBg` | Light tooltip fill |
| `postFallback` / `orphan` | Untinted / orphan nodes |
| `postSelected` | Selected / highlighted post fill |
| `megaSelectedStroke` | Selected narrative outline |
| `dimAlpha` | Opacity for non-selected nodes while a narrative is focused |
| `hoverStroke` | Hover outline |

## Rendering pipeline

1. Clear off-white background (DPR-aware canvas).
2. Apply `d3.zoom` transform.
3. Draw parent links. Draw post links only while focused or at ≥180% fit zoom.
4. Draw posts → narratives → parent topics (parents on top).
5. Draw zoom-gated black labels; dashed ring on user-anchored parents.
6. Screen-space hover tooltip (black text on light chip).

Simulation ticks and post interpolation use a coalesced animation-frame redraw. Offscreen nodes and links are culled.

## Performance notes

Designed for the current ~5.5k-node dataset:

- D3 simulates only parent topics and narratives (roughly 411 nodes).
- Posts never participate in global link, repel, collide, or orbit forces.
- Post packing is deterministic and local to each narrative.
- Dense narratives affect global layout through one cloud radius, avoiding force multiplication by post count.
- Anchor changes skip simulation when there is no overlap and otherwise settle only immediate structural neighbors.
- Canvas rendering culls offscreen content and suppresses thousands of post links at fit zoom.
- All structural nodes pin after settling, so idle physics cost is zero.

## Switching datasets

1. Point `DATA_FILE` at another node-link JSON with the same schema (`nodes[].id|type|label`, `links[].source|target`).
2. Supported `type` values: `mega_mega_node`, `mega_node`, `regular_node`.
3. Two-level graphs (mega + regular only) still load; orphans pack near the center and use orphan colors.

## Keyboard / accessibility

- `Escape` closes the detail panel.
- Panel has an explicit close control.
- Drag targets are the large parent circles (easier hit area).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank / load error text | Serve over HTTP; confirm `DATA_FILE` exists |
| Everything in a huge empty ring | Check aggregate `clusterExtent`, `CLUSTER_PITCH`, and `MEGA_MEGA_REPEL` |
| Families overlap | Increase `CLUSTER_PACK_PAD`, `FAMILY_COLLIDE_PAD`, or `TOPIC_COLLIDE_PAD` |
| Posts too far from narratives | Lower `LINK_GAP` or the local post spacing in `placePostsByStance` |
| Old clusters move after anchoring | Confirm posts are excluded from `structuralNodes` and only overlap neighbors are unpinned |
| Drag pans the canvas instead | Start the drag on the parent circle body; zoom filter ignores pan when a parent is under the pointer |
| Labels missing | Narrative labels need zoom past ~175% of fit; parent-topic labels always show |

## Tech stack

- Vanilla HTML / CSS / JS (no bundler)
- [D3 v7.9.0](https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js) — `forceSimulation`, `forceLink`, `forceManyBody`, `forceCollide`, `quadtree`, `zoom`
- Canvas 2D rendering
