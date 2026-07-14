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
| `graph_output_topic_parent_topic.json` | **Active** dataset (3-level hierarchy) |
| `CJP-SEARCH-RESULTS - l1-iteration-1-sentiment.csv` | Post sentiment / stance sheet (joined by `post_id` ↔ node `id`) |
| `graph_output_subtopic.json` | Earlier 2-level dataset (not loaded by default) |
| `README.md` | This document |

See also [`../platform-profiles/`](../platform-profiles/) for the platform → profile graph.

Active data path is set in `app.js` as:

```js
const DATA_FILE = "graph_output_topic_parent_topic.json";
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
| `post_link` | `mega_node` ↔ `regular_node` | Very short spring (`LINK_GAP`) so posts hug narratives |

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

1. **Seed (once, before sim)**
   - Parent topics packed in a **filled golden-angle disc** (`CLUSTER_PITCH`) — not a hollow ring.
   - Narratives fan tightly around their parent topic.
   - Posts fan tightly around their narrative.
2. **Forces (lightweight)**
   - `forceLink` — short typed distances, high strength.
   - `repelMegaMega` — many-body **only** on parent topics (keeps families apart).
   - `repelForeignMegas` — megas with **different** `parentId` push apart.
   - `repelForeignPosts` — posts with **different** narrative parents push apart.
   - `forceCollide` — circle-only radii (no label AABB); low iteration count.
   - **No center gravity** (avoids sucking everything toward the middle).
3. **Settle**
   - When the simulation ends, parent topics and narratives are pinned (`fx`/`fy`).
   - View **fits** the graph into the viewport (accounts for open side panel width).

### Colors (family tinting)

Each `mega_mega_node` gets a color from `FAMILY_PALETTE` (dull slate/taupe/sage tones). All of its `mega_node` children inherit that fill. Posts get a lightened version of the narrative’s family color. Links are tinted with the same family at low alpha.

Orphaned narratives (no parent topic) use `COLORS.orphan`.

### Labels & clutter control

- **Parent topic labels** (`mega_mega_node`) always draw in world space so they **grow/shrink with zoom**.
- **Narrative labels** draw only when zoom ≥ `baselineZoom * LABEL_ZOOM_MULT` (default ~175% of fit zoom). Truncated with ellipsis.
- **Post labels** never draw on the canvas at rest; hover shows a tooltip; click opens the panel.
- **All text is black** (chrome, panel, graph labels, tooltip text). Tooltips use a light background so black text stays readable.

### Interaction

| Action | Behavior |
|--------|----------|
| Scroll wheel | Zoom toward cursor (`d3.zoom`, scale extent `0.02–12`) |
| Drag empty canvas | Pan |
| Hover post / mega / parent | Outline / tooltip with full display name |
| Click post | Opens right **detail panel** with CSV sentiment fields when `post_id` matches (stance, content, reasoning, URL, …) |
| **Click narrative (`mega_node`)** | Opens panel with stance **distribution bar + %**, post list; **highlights** posts with **stance-colored borders**; focuses camera. Same-stance posts are clustered around the narrative. |
| Click empty / other / Escape / panel × | Closes panel; clears highlight |
| **Drag `mega_mega_node`** | Moves the parent **and** its linked narratives + posts as one cluster; on release the parent is **anchored** (`userPinned`) at that position. A dashed black ring marks anchored parents. |

Dragging a parent topic suppresses pan/zoom on that gesture. After drop, a brief low-alpha restart lets posts settle; the anchored parent stays fixed.

### Side panel fields

**Post mode**

- **Post ID** — original string `rawId` (matched to CSV `post_id`)
- **Stance / content / reasoning / details / URL** — from the sentiment sheet when present
- **Narrative** — linked `mega_node` title(s) and parent topic name(s)

**Narrative (`mega_node`) mode**

- **Narrative ID** / **Label** / **Parent topic**
- **Stance distribution** — stacked percentage bar + counts (`post_count` / `percentage` per stance)
- **Posts** — stance-sorted list (click a card to open that post)

## Settings reference (`app.js`)

Tune these constants near the top of `app.js`, then hard-refresh.

### Visual / size

| Constant | Default | Meaning |
|----------|---------|---------|
| `POST_R` | `3` | Post circle radius (world units) |
| `MEGA_R_MIN` / `MEGA_R_MAX` | `12` / `22` | Narrative radius range (scales with degree) |
| `MEGA_MEGA_R_MIN` / `MEGA_MEGA_R_MAX` | `28` / `42` | Parent topic radius range |
| `LINK_GAP` | `4` | Extra gap on mega↔post link distance (smaller ⇒ posts closer) |
| `PARENT_LINK_GAP` | `14` | Extra gap on parent↔mega link distance (smaller ⇒ family tighter) |
| `CLUSTER_PITCH` | `280` | Packing scale for parent-topic seed disc (larger ⇒ more space between families at seed) |
| `LABEL_ZOOM_MULT` | `1.75` | Narrative labels appear at this multiple of fit zoom |
| `MEGA_MEGA_LABEL_SIZE` | `11` | Parent-topic label font size in world units (scales with zoom on screen) |
| `MEGA_LABEL_MAX_CHARS` | `20` | Max narrative label chars on-canvas |
| `MEGA_MEGA_LABEL_MAX_CHARS` | `24` | Max parent topic label chars on-canvas |
| `FAMILY_PALETTE` | 13 dull hex colors | Rotating colors for parent topics |

### Forces / clustering

| Constant | Default | Meaning |
|----------|---------|---------|
| `MEGA_MEGA_REPEL` | `520` | Parent-topic many-body strength magnitude |
| `MEGA_MEGA_REPEL_DIST` | `420` | Max distance for parent many-body |
| `FOREIGN_MEGA_REPEL` | `55` | Strength of cross-family mega↔mega push |
| `FOREIGN_MEGA_DIST_MAX` | `160` | Range of foreign mega repel |
| `FOREIGN_POST_REPEL` | `22` | Strength of cross-narrative post↔post push |
| `FOREIGN_POST_DIST_MAX` | `48` | Range of foreign post repel |
| Simulation `alphaDecay` | `0.05` | Faster settle ⇒ lower cost |
| Simulation `velocityDecay` | `0.5` | Higher ⇒ less overshoot |
| Collide `iterations` | `2` | Keep low for performance |
| Link strength parent / post | `0.9` / `1` | How tightly children hug parents |

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
3. Draw parent links (family tint), then post links.
4. Draw posts → narratives → parent topics (parents on top).
5. Draw zoom-gated black labels; dashed ring on user-anchored parents.
6. Screen-space hover tooltip (black text on light chip).

Redraws on: sim ticks (while hot), zoom, hover changes, drag, panel open/close.

## Performance notes

Designed for ~1.5k nodes without the heavy patterns from experimental layouts:

- Canvas instead of SVG.
- No per-tick unused quadtree work outside the foreign-repel forces.
- No post many-body over the whole graph.
- Foreign repels use **short-range quadtrees** and skip same-parent pairs.
- Collide iterations kept low; label size not included in collide radius.
- Pins hubs after settle to stop continuous layout cost.

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
| Everything in a huge empty ring | Raise was fixed by disc seeding; if regressing, check `CLUSTER_PITCH` vs extreme `MEGA_MEGA_REPEL` |
| Families overlap | Increase `CLUSTER_PITCH`, `MEGA_MEGA_REPEL`, collide halo on parents |
| Posts too far from narratives | Lower `LINK_GAP` / raise post link strength |
| Drag pans the canvas instead | Start the drag on the parent circle body; zoom filter ignores pan when a parent is under the pointer |
| Labels missing | Narrative labels need zoom past ~175% of fit; parent-topic labels always show |

## Tech stack

- Vanilla HTML / CSS / JS (no bundler)
- [D3 v7.9.0](https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js) — `forceSimulation`, `forceLink`, `forceManyBody`, `forceCollide`, `quadtree`, `zoom`
- Canvas 2D rendering
