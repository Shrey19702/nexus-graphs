(() => {
  // Shared structural colors (Nexus Civic Signal theme)
  const COLORS = {
    bg: "#FAFBFC",
    edge: "#D9DEE4",
    text: "#1F2937",
    mutedText: "#6B7280",
    selectionRing: "#2563EB",
    postFallback: "#9AA5B1",
    postNoData: "#E9ECF0",
    postSelected: "#9AA5B1",
    megaSelectedStroke: "#2563EB",
    hoverStroke: "#6B7280",
    tooltipBg: "rgba(255, 255, 255, 0.96)",
    tooltipText: "#1F2937",
    tooltipBorder: "#D9DEE4",
    orphan: "#9AA5B1",
    orphanStroke: "#CBD2DA",
    dimAlpha: 0.22,
  };

  // Dull, distinct family colors — one per mega_mega_node
  const FAMILY_PALETTE = [
    "#7d8b99",
    "#8a7f72",
    "#6f8579",
    "#7c748c",
    "#8a7a6c",
    "#6e8490",
    "#85786e",
    "#748a80",
    "#8a7482",
    "#6f7f8a",
    "#87856f",
    "#7a6e82",
    "#708890",
  ];

  const POST_R_DEFAULT = 3;
  const LINK_GAP = 1.5;
  const NARRATIVE_SIZE_DEFAULT = 17;
  const TOPIC_SIZE_DEFAULT = 35;
  const PARENT_LINK_GAP = 6;
  // Base pack pitch for equal-sized families; large post clouds inflate this per-parent
  const CLUSTER_PITCH = 220;
  const CLUSTER_PACK_PAD = 36;
  const FOREIGN_MEGA_REPEL = 32;
  const FOREIGN_MEGA_DIST_MAX = 120;
  const MEGA_MEGA_REPEL = 220;
  const MEGA_MEGA_REPEL_DIST = 280;
  const FAMILY_COLLIDE_PAD = 28;
  const TOPIC_COLLIDE_PAD = 6;
  // Initial placement gets time to resolve large topic/post footprints.
  // Anchor overlap repairs remain deliberately short in restartSettleAfterAnchor().
  const INITIAL_SIMULATION_ALPHA = 0.92;
  const INITIAL_SIMULATION_ALPHA_MIN = 0.002;
  const INITIAL_SIMULATION_ALPHA_DECAY = 0.018;
  const INITIAL_SIMULATION_VELOCITY_DECAY = 0.68;
  const LOCAL_SETTLE_ALPHA = 0.14;
  const POST_LERP = 0.24;
  const POST_LERP_EPSILON = 0.04;
  // Labels only after deep zoom so text doesn't blanket the graph (~4.5× fit zoom)
  const LABEL_ZOOM_MULT = 4.5;
  const MEGA_LABEL_MAX_CHARS = 22;
  const MEGA_MEGA_LABEL_MAX_CHARS = 26;
  // World-space font size for parent-topic labels (scales on screen with zoom)
  const MEGA_MEGA_LABEL_SIZE = 10;
  // Political axis used to order narratives in the parent-topic panel
  const NARRATIVE_SORT_STANCES = [
    "pro_government",
    "pro_cjp",
    "anti_cjp",
    "anti_government",
  ];
  const GOLDEN_ANGLE = 2.399963229728653;
  const CLICK_MOVE_PX = 5;
  const DATA_FILE = "15jul-narrative-graph.json";
  const SENTIMENT_FILE = "all-nexus-data-till-15jul.csv";
  const PANEL_MAX_W = 400;

  const SETTINGS_DEFAULTS = {
    topicSize: TOPIC_SIZE_DEFAULT,
    narrativeSize: NARRATIVE_SIZE_DEFAULT,
    postSize: POST_R_DEFAULT,
    showEmptyTopics: false,
  };
  const settings = { ...SETTINGS_DEFAULTS };

  // Stance palette (pro → anti). Borders use these when a narrative is selected.
  const STANCE_ORDER = [
    "pro_government",
    "pro_cjp",
    "neutral_news",
    "unclear",
    "mixed",
    "anti_cjp",
    "anti_government",
  ];
  // Civic Signal sentiment palette (posts + stance UI)
  const STANCE_COLORS = {
    pro_government: "#1B7F5C",
    pro_cjp: "#94C25E",
    neutral_news: "#9AA5B1",
    unclear: "#CBD2DA",
    mixed: "#A8B0BA",
    anti_cjp: "#E8853D",
    anti_government: "#D64545",
  };
  const STANCE_LABELS = {
    pro_government: "Pro government",
    pro_cjp: "Pro CJP",
    neutral_news: "Neutral / news",
    unclear: "Unclear",
    mixed: "Mixed",
    anti_cjp: "Anti CJP",
    anti_government: "Anti government",
  };
  const UNKNOWN_STANCE = "unknown";
  const BLAND_GREY = "#E9ECF0";

  const canvas = document.getElementById("graph");
  const ctx = canvas.getContext("2d");
  const zoomLabel = document.getElementById("zoom-label");
  const fitViewBtn = document.getElementById("fit-view");
  const panelEl = document.getElementById("panel");
  const panelClose = document.getElementById("panel-close");
  const panelTitle = document.getElementById("panel-title");
  const panelBody = document.getElementById("panel-body");
  const settingsEl = document.getElementById("settings");
  const settingsToggle = document.getElementById("settings-toggle");
  const settingsClose = document.getElementById("settings-close");
  const settingsReset = document.getElementById("settings-reset");

  const state = {
    nodes: [],
    links: [],
    byId: new Map(),
    parentTopics: [],
    narratives: [],
    posts: [],
    structuralNodes: [],
    structuralLinks: [],
    megasByParent: new Map(),
    postsByMega: new Map(),
    transform: d3.zoomIdentity,
    simulation: null,
    hovered: null,
    selected: null,
    highlightIds: null,
    stanceFilter: null,
    dragging: null,
    baselineZoom: 1,
    width: 0,
    height: 0,
    dpr: 1,
    settled: false,
    sentimentById: null,
    skipFitOnSimEnd: false,
    settleParentIds: null,
    renderFrame: null,
    postsAnimating: false,
  };

  let zoomBehavior = null;
  let pointerDown = null;

  function postR() {
    return settings.postSize;
  }

  function narrativeSizeRange() {
    const base = settings.narrativeSize;
    return { min: base * 0.7, max: base * 1.3 };
  }

  function topicSizeRange() {
    const base = settings.topicSize;
    return { min: base * 0.8, max: base * 1.2 };
  }

  function nodeRadius(d) {
    if (d.type === "mega_mega_node" || d.type === "mega_node") return d.radius;
    return postR();
  }

  function applyNodeRadii() {
    const topic = topicSizeRange();
    const narrative = narrativeSizeRange();
    for (const n of state.nodes) {
      if (n.type === "mega_mega_node") {
        n.radius = scaleRadius(n.degree, topic.min, topic.max, 160);
      } else if (n.type === "mega_node") {
        n.radius = scaleRadius(n.degree, narrative.min, narrative.max, 120);
        n.farthestPostDistance = 0;
      } else {
        n.radius = postR();
      }
    }
    refreshClusterExtents();
  }

  function scaleRadius(degree, minR, maxR, maxDeg = 140) {
    const t = Math.sqrt(Math.max(degree, 1));
    const maxT = Math.sqrt(maxDeg);
    const n = Math.min(1, Math.max(0, (t - 1) / (maxT - 1)));
    return minR + n * (maxR - minR);
  }

  // Estimate the farthest post *centre* from a narrative. This is the structural
  // collision radius: posts are outside the D3 simulation, so their outermost
  // centre must reserve the space they visibly occupy.
  function estimateFarthestPostDistance(mega, postCount) {
    const count = Math.max(0, postCount ?? mega.childPostCount ?? 0);
    if (!count) return mega.radius;
    const pr = postR();
    const packR = Math.sqrt(count) * (pr + 2.1) * 0.82;
    return mega.radius + LINK_GAP + pr + packR;
  }

  function refreshClusterExtents() {
    for (const n of state.narratives) {
      n.childPostCount = state.postsByMega.get(n.id)?.length || 0;
      n.topicCollisionRadius = Math.max(
        n.radius,
        estimateFarthestPostDistance(n, n.childPostCount),
        n.farthestPostDistance || 0
      );
      // Retain the visual edge extent for family sizing; only the centre
      // distance participates in topic collision.
      n.cloudRadius = n.topicCollisionRadius + postR();
    }
    for (const n of state.parentTopics) {
      const megas = state.megasByParent.get(n.id) || [];
      let outer = n.radius;
      for (const m of megas) {
        // Hub radius: orbit distance to narrative + that narrative's post cloud.
        outer = Math.max(outer, parentLinkDistance(n, m) + topicCollisionRadius(m));
      }
      n.clusterExtent = outer + CLUSTER_PACK_PAD;
    }
  }

  function typeRepel(strengthMag, distanceMax, predicate) {
    const f = d3
      .forceManyBody()
      .strength(-strengthMag)
      .distanceMax(distanceMax)
      .theta(0.9);
    const base = f.initialize;
    f.initialize = (nodes, random) =>
      base.call(
        f,
        nodes.filter(predicate),
        random
      );
    return f;
  }

  function typeCollide(radius, strength, iterations, predicate) {
    const f = d3
      .forceCollide()
      .radius(radius)
      .strength(strength)
      .iterations(iterations);
    const base = f.initialize;
    f.initialize = (nodes, random) =>
      base.call(
        f,
        nodes.filter(predicate),
        random
      );
    return f;
  }

  // Generic: push same-type nodes apart when their parentKey differs.
  function forceForeignClusterRepel(opts) {
    const {
      type,
      parentKey,
      strength,
      distanceMax,
    } = opts;
    let nodes = [];
    const dist2Max = distanceMax * distanceMax;

    function force(alpha) {
      const items = [];
      for (const n of nodes) {
        if (n.type === type && Number.isFinite(n.x) && Number.isFinite(n.y)) {
          items.push(n);
        }
      }
      if (items.length < 2) return;

      const tree = d3.quadtree(items, (d) => d.x, (d) => d.y);
      const s = strength * alpha;

      for (const a of items) {
        tree.visit((quad, x0, y0, x1, y1) => {
          const b = quad.data;
          if (b) {
            if (a === b || a.id >= b.id) return;
            const ap = a[parentKey];
            const bp = b[parentKey];
            if (ap != null && bp != null && ap === bp) return;

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 >= dist2Max || dist2 === 0) return;

            const dist = Math.sqrt(dist2);
            const mag = (s * (1 - dist / distanceMax)) / dist;
            const fx = dx * mag;
            const fy = dy * mag;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
            return;
          }

          return (
            x0 > a.x + distanceMax ||
            x1 < a.x - distanceMax ||
            y0 > a.y + distanceMax ||
            y1 < a.y - distanceMax
          );
        });
      }
    }

    force.initialize = (initNodes) => {
      nodes = initNodes;
    };
    return force;
  }

  function darkenHex(hex, amount = 0.22) {
    const n = hex.replace("#", "");
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    const f = (c) => Math.max(0, Math.round(c * (1 - amount)));
    return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }

  function lightenHex(hex, amount = 0.35) {
    const n = hex.replace("#", "");
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    const f = (c) => Math.min(255, Math.round(c + (255 - c) * amount));
    return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }

  function hexToRgba(hex, alpha) {
    const n = hex.replace("#", "");
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function stanceColor(stance) {
    if (!stance || stance === UNKNOWN_STANCE) return BLAND_GREY;
    return STANCE_COLORS[stance] || BLAND_GREY;
  }

  function stanceKey(post) {
    const s = post?.stance || post?.sentiment?.stance;
    if (s && STANCE_COLORS[s]) return s;
    return UNKNOWN_STANCE;
  }

  function parseCsv(text) {
    const rows = [];
    let i = 0;
    const len = text.length;

    function readField() {
      if (i >= len) return "";
      if (text[i] === '"') {
        i += 1;
        let out = "";
        while (i < len) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') {
              out += '"';
              i += 2;
              continue;
            }
            i += 1;
            break;
          }
          out += text[i];
          i += 1;
        }
        return out;
      }
      let out = "";
      while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
        out += text[i];
        i += 1;
      }
      return out;
    }

    function readRow() {
      const fields = [];
      if (i >= len) return null;
      while (i < len) {
        fields.push(readField());
        if (i >= len) break;
        if (text[i] === ",") {
          i += 1;
          continue;
        }
        if (text[i] === "\r") i += 1;
        if (text[i] === "\n") i += 1;
        break;
      }
      return fields;
    }

    const header = readRow();
    if (!header) return [];
    while (i < len) {
      if (text[i] === "\n" || text[i] === "\r") {
        i += 1;
        continue;
      }
      const fields = readRow();
      if (!fields || (fields.length === 1 && fields[0] === "" && i >= len)) break;
      const obj = {};
      for (let c = 0; c < header.length; c += 1) {
        obj[header[c]] = fields[c] ?? "";
      }
      rows.push(obj);
    }
    return rows;
  }

  function attachSentiment(records) {
    const byPostId = new Map();
    for (const row of records) {
      if (row.post_id) byPostId.set(String(row.post_id), row);
    }
    state.sentimentById = byPostId;
    let matched = 0;
    for (const n of state.nodes) {
      if (n.type !== "regular_node") continue;
      const row = byPostId.get(String(n.rawId));
      if (!row) {
        n.sentiment = null;
        n.stance = null;
        n.stanceIndex = STANCE_ORDER.length;
        continue;
      }
      matched += 1;
      n.sentiment = row;
      n.stance = row.stance || null;
      const idx = STANCE_ORDER.indexOf(n.stance);
      n.stanceIndex = idx >= 0 ? idx : STANCE_ORDER.length;
    }
    console.info(`Sentiment matched ${matched} / ${byPostId.size} CSV rows to graph posts`);
  }

  function computeStanceDistribution(posts) {
    const counts = Object.create(null);
    for (const key of STANCE_ORDER) counts[key] = 0;
    counts[UNKNOWN_STANCE] = 0;
    for (const p of posts) {
      const key = stanceKey(p);
      counts[key] = (counts[key] || 0) + 1;
    }
    const total = posts.length;
    const entries = [];
    for (const key of [...STANCE_ORDER, UNKNOWN_STANCE]) {
      const postCount = counts[key] || 0;
      if (!postCount && key === UNKNOWN_STANCE) continue;
      if (!postCount && !counts[key]) continue;
      entries.push({
        stance: key,
        post_count: postCount,
        percentage: total ? Math.round((postCount / total) * 10000) / 100 : 0,
        color: stanceColor(key),
        label: key === UNKNOWN_STANCE ? "No sentiment" : (STANCE_LABELS[key] || key),
      });
    }
    return { total, entries };
  }

  function topicCollisionRadius(d) {
    return d.type === "mega_node"
      ? d.topicCollisionRadius || d.radius
      : d.radius || postR();
  }

  function parentLinkDistance(parent, mega) {
    return parent.radius + PARENT_LINK_GAP + topicCollisionRadius(mega);
  }

  // Translate a parent hub and its narratives together so family spacing never
  // leaves children behind (which previously yanked parents back into a pile).
  function nudgeFamilyVelocity(parent, vx, vy) {
    parent.vx = (parent.vx || 0) + vx;
    parent.vy = (parent.vy || 0) + vy;
    for (const mega of state.megasByParent.get(parent.id) || []) {
      mega.vx = (mega.vx || 0) + vx;
      mega.vy = (mega.vy || 0) + vy;
    }
  }

  function translateFamily(parent, dx, dy) {
    parent.x += dx;
    parent.y += dy;
    for (const mega of state.megasByParent.get(parent.id) || []) {
      mega.x += dx;
      mega.y += dy;
    }
  }

  // Parent is the sole attractor: only narratives receive spring force.
  function forceParentAttract(strength = 0.95) {
    let pairs = [];
    function force(alpha) {
      const s = strength * alpha;
      for (const { parent, mega } of pairs) {
        if (!Number.isFinite(parent.x) || !Number.isFinite(mega.x)) continue;
        if (mega.fx != null || mega.fy != null) continue;
        let dx = mega.x - parent.x;
        let dy = mega.y - parent.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) {
          dx = 0.01;
          dy = 0;
          dist = 0.01;
        }
        const target = parentLinkDistance(parent, mega);
        const mag = ((dist - target) / dist) * s;
        mega.vx -= dx * mag;
        mega.vy -= dy * mag;
      }
    }
    force.initialize = (nodes) => {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      pairs = [];
      for (const link of activeStructuralLinks()) {
        const s = typeof link.source === "object" ? link.source : byId.get(link.source);
        const t = typeof link.target === "object" ? link.target : byId.get(link.target);
        if (!s || !t) continue;
        if (s.type === "mega_mega_node" && t.type === "mega_node") {
          pairs.push({ parent: s, mega: t });
        } else if (t.type === "mega_mega_node" && s.type === "mega_node") {
          pairs.push({ parent: t, mega: s });
        }
      }
    };
    return force;
  }

  // Narratives collide with each other and with foreign parent hubs.
  // Own-parent pairs use the attractor force; parent↔parent uses family collide.
  function forceTopicCollide(strength = 1.2) {
    let megas = [];
    let parents = [];
    function force(alpha) {
      const s = strength * alpha;
      for (let i = 0; i < megas.length; i += 1) {
        const a = megas[i];
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
        if (a.fx != null || a.fy != null) continue;

        for (let j = i + 1; j < megas.length; j += 1) {
          const b = megas[j];
          if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          const minDist = topicCollisionRadius(a) + topicCollisionRadius(b) + TOPIC_COLLIDE_PAD;
          if (dist >= minDist) continue;
          if (dist < 1e-6) {
            dx = 0.01;
            dy = 0;
            dist = 0.01;
          }
          const push = ((minDist - dist) / dist) * s;
          const fx = dx * push;
          const fy = dy * push;
          const bFixed = b.fx != null || b.fy != null;
          if (!bFixed) {
            a.vx -= fx * 0.5;
            a.vy -= fy * 0.5;
            b.vx += fx * 0.5;
            b.vy += fy * 0.5;
          } else {
            a.vx -= fx;
            a.vy -= fy;
          }
        }

        for (const parent of parents) {
          if (a.parentId === parent.id) continue;
          if (!Number.isFinite(parent.x) || !Number.isFinite(parent.y)) continue;
          let dx = a.x - parent.x;
          let dy = a.y - parent.y;
          let dist = Math.hypot(dx, dy);
          const minDist = topicCollisionRadius(a) + parent.radius + TOPIC_COLLIDE_PAD;
          if (dist >= minDist) continue;
          if (dist < 1e-6) {
            dx = 0.01;
            dy = 0;
            dist = 0.01;
          }
          const push = ((minDist - dist) / dist) * s;
          a.vx += dx * push;
          a.vy += dy * push;
        }
      }
    }
    force.initialize = (nodes) => {
      megas = nodes.filter((n) => n.type === "mega_node");
      parents = nodes.filter((n) => n.type === "mega_mega_node");
    };
    return force;
  }

  // Geometric cleanup that preserves the parent-as-hub rule.
  function resolveTopicCollisions(passes = 18) {
    const parents = activeStructuralNodes().filter((n) => n.type === "mega_mega_node");
    const megas = activeStructuralNodes().filter((n) => n.type === "mega_node");

    for (let pass = 0; pass < passes; pass += 1) {
      let moved = false;

      for (let i = 0; i < parents.length; i += 1) {
        const a = parents[i];
        for (let j = i + 1; j < parents.length; j += 1) {
          const b = parents[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          const minDist =
            (a.clusterExtent || a.radius) +
            (b.clusterExtent || b.radius) +
            FAMILY_COLLIDE_PAD;
          if (dist >= minDist) continue;
          if (dist < 1e-6) {
            dx = 0.01;
            dy = 0;
            dist = 0.01;
          }
          const overlap = (minDist - dist) / dist;
          const aFixed = a.fx != null || a.fy != null || a.userPinned;
          const bFixed = b.fx != null || b.fy != null || b.userPinned;
          if (!aFixed && !bFixed) {
            translateFamily(a, -dx * overlap * 0.5, -dy * overlap * 0.5);
            translateFamily(b, dx * overlap * 0.5, dy * overlap * 0.5);
          } else if (!aFixed) {
            translateFamily(a, -dx * overlap, -dy * overlap);
          } else if (!bFixed) {
            translateFamily(b, dx * overlap, dy * overlap);
          } else {
            continue;
          }
          moved = true;
        }
      }

      for (let i = 0; i < megas.length; i += 1) {
        const a = megas[i];
        if (a.fx != null || a.fy != null) continue;
        for (let j = i + 1; j < megas.length; j += 1) {
          const b = megas[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          const minDist = topicCollisionRadius(a) + topicCollisionRadius(b) + TOPIC_COLLIDE_PAD;
          if (dist >= minDist) continue;
          if (dist < 1e-6) {
            dx = 0.01;
            dy = 0;
            dist = 0.01;
          }
          const overlap = (minDist - dist) / dist;
          if (b.fx != null || b.fy != null) {
            a.x -= dx * overlap;
            a.y -= dy * overlap;
          } else {
            a.x -= dx * overlap * 0.5;
            a.y -= dy * overlap * 0.5;
            b.x += dx * overlap * 0.5;
            b.y += dy * overlap * 0.5;
          }
          moved = true;
        }

        const parent = a.parentId != null ? state.byId.get(a.parentId) : null;
        if (parent && Number.isFinite(parent.x)) {
          let dx = a.x - parent.x;
          let dy = a.y - parent.y;
          let dist = Math.hypot(dx, dy);
          const minDist = parentLinkDistance(parent, a);
          if (dist < minDist) {
            if (dist < 1e-6) {
              dx = 0.01;
              dy = 0;
              dist = 0.01;
            }
            const scale = minDist / dist;
            a.x = parent.x + dx * scale;
            a.y = parent.y + dy * scale;
            moved = true;
          }
        }
      }

      if (!moved) break;
    }
  }

  // Aggregate family collision: move each parent hub with its narratives.
  function forceFamilyCollide(strength = 1.15) {
    let parents = [];
    function force(alpha) {
      const s = strength * alpha;
      for (let i = 0; i < parents.length; i += 1) {
        const a = parents[i];
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
        for (let j = i + 1; j < parents.length; j += 1) {
          const b = parents[j];
          if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          const minDist =
            (a.clusterExtent || a.radius) +
            (b.clusterExtent || b.radius) +
            FAMILY_COLLIDE_PAD;
          if (dist >= minDist) continue;
          if (dist < 1e-6) {
            dx = 0.01;
            dy = 0;
            dist = 0.01;
          }
          const push = ((minDist - dist) / dist) * s;
          const fx = dx * push;
          const fy = dy * push;
          const aFixed = a.fx != null || a.fy != null;
          const bFixed = b.fx != null || b.fy != null;
          if (!aFixed && !bFixed) {
            nudgeFamilyVelocity(a, -fx * 0.5, -fy * 0.5);
            nudgeFamilyVelocity(b, fx * 0.5, fy * 0.5);
          } else if (!aFixed) {
            nudgeFamilyVelocity(a, -fx, -fy);
          } else if (!bFixed) {
            nudgeFamilyVelocity(b, fx, fy);
          }
        }
      }
    }

    force.initialize = (initNodes) => {
      parents = initNodes.filter((n) => n.type === "mega_mega_node");
    };
    return force;
  }

  // Parent hubs repel as rigid family discs so topic-topic gaps stay intact.
  function forceFamilyRepel(strengthMag, distanceMax) {
    let parents = [];
    const dist2Max = distanceMax * distanceMax;
    function force(alpha) {
      const s = strengthMag * alpha;
      for (let i = 0; i < parents.length; i += 1) {
        const a = parents[i];
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
        if (a.fx != null || a.fy != null) continue;
        for (let j = i + 1; j < parents.length; j += 1) {
          const b = parents[j];
          if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist2 = dx * dx + dy * dy;
          if (dist2 >= dist2Max || dist2 === 0) continue;
          const dist = Math.sqrt(dist2);
          const mag = (s * (1 - dist / distanceMax)) / dist;
          const fx = dx * mag;
          const fy = dy * mag;
          const bFixed = b.fx != null || b.fy != null;
          if (!bFixed) {
            nudgeFamilyVelocity(a, -fx * 0.5, -fy * 0.5);
            nudgeFamilyVelocity(b, fx * 0.5, fy * 0.5);
          } else {
            nudgeFamilyVelocity(a, -fx, -fy);
          }
        }
      }
    }
    force.initialize = (nodes) => {
      parents = nodes.filter((n) => n.type === "mega_mega_node");
    };
    return force;
  }

  function getDims() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  function resizeCanvas() {
    const { width, height } = getDims();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    state.width = width;
    state.height = height;
    state.dpr = dpr;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function typedIndex(nodes) {
    const byTypeRaw = {
      mega_mega_node: new Map(),
      mega_node: new Map(),
      regular_node: new Map(),
    };
    for (const n of nodes) {
      byTypeRaw[n.type]?.set(n.rawId, n);
    }
    return byTypeRaw;
  }

  // Resolve ambiguous string endpoints using type priority + self-link = parent→child.
  function resolveEndpoint(rawId, role, byTypeRaw, otherRawId) {
    if (role === "self-parent") return byTypeRaw.mega_mega_node.get(rawId) || null;
    if (role === "self-child") return byTypeRaw.mega_node.get(rawId) || null;

    if (role === "target") {
      return (
        byTypeRaw.regular_node.get(rawId) ||
        byTypeRaw.mega_node.get(rawId) ||
        byTypeRaw.mega_mega_node.get(rawId) ||
        null
      );
    }

    // source: prefer the parent of whatever the target is expected to be
    const targetGuess =
      byTypeRaw.regular_node.get(otherRawId) ||
      byTypeRaw.mega_node.get(otherRawId) ||
      byTypeRaw.mega_mega_node.get(otherRawId);

    if (targetGuess?.type === "regular_node") {
      return (
        byTypeRaw.mega_node.get(rawId) ||
        byTypeRaw.mega_mega_node.get(rawId) ||
        null
      );
    }
    if (targetGuess?.type === "mega_node") {
      return (
        byTypeRaw.mega_mega_node.get(rawId) ||
        byTypeRaw.mega_node.get(rawId) ||
        null
      );
    }
    return (
      byTypeRaw.mega_mega_node.get(rawId) ||
      byTypeRaw.mega_node.get(rawId) ||
      byTypeRaw.regular_node.get(rawId) ||
      null
    );
  }

  function loadGraph(data) {
    // Keep every node record; assign a fresh unique numeric id (ignore string collisions).
    const nodes = (data.nodes || []).map((n, i) => ({
      id: i,
      rawId: n.id,
      type: n.type,
      label: n.label || "",
      radius: POST_R_DEFAULT,
      degree: 0,
      parentId: null,
      parentIds: [],
      displayLabel: "",
    }));

    const byTypeRaw = typedIndex(nodes);
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const links = [];
    for (const l of data.links || []) {
      const sourceRaw = l.source;
      const targetRaw = l.target;
      let src;
      let tgt;

      if (sourceRaw === targetRaw) {
        src = resolveEndpoint(sourceRaw, "self-parent", byTypeRaw, targetRaw);
        tgt = resolveEndpoint(targetRaw, "self-child", byTypeRaw, sourceRaw);
      } else {
        tgt = resolveEndpoint(targetRaw, "target", byTypeRaw, sourceRaw);
        src = resolveEndpoint(sourceRaw, "source", byTypeRaw, targetRaw);
      }

      if (!src || !tgt || src.id === tgt.id) continue;
      links.push({
        source: src.id,
        target: tgt.id,
        kind:
          src.type === "mega_mega_node" || tgt.type === "mega_mega_node"
            ? "parent_link"
            : "post_link",
      });
    }

    // Parent: mega_mega → mega
    const megaParents = new Map();
    // Parent: mega → regular
    const postParents = new Map();

    for (const l of links) {
      const src = byId.get(l.source);
      const tgt = byId.get(l.target);
      if (!src || !tgt) continue;

      if (src.type === "mega_mega_node" && tgt.type === "mega_node") {
        if (!megaParents.has(tgt.id)) megaParents.set(tgt.id, []);
        const list = megaParents.get(tgt.id);
        if (!list.includes(src.id)) list.push(src.id);
      } else if (tgt.type === "mega_mega_node" && src.type === "mega_node") {
        if (!megaParents.has(src.id)) megaParents.set(src.id, []);
        const list = megaParents.get(src.id);
        if (!list.includes(tgt.id)) list.push(tgt.id);
      } else if (src.type === "mega_node" && tgt.type === "regular_node") {
        if (!postParents.has(tgt.id)) postParents.set(tgt.id, []);
        const list = postParents.get(tgt.id);
        if (!list.includes(src.id)) list.push(src.id);
      } else if (tgt.type === "mega_node" && src.type === "regular_node") {
        if (!postParents.has(src.id)) postParents.set(src.id, []);
        const list = postParents.get(src.id);
        if (!list.includes(tgt.id)) list.push(tgt.id);
      }
    }

    const degree = new Map(nodes.map((n) => [n.id, 0]));
    for (const l of links) {
      degree.set(l.source, (degree.get(l.source) || 0) + 1);
      degree.set(l.target, (degree.get(l.target) || 0) + 1);
    }

    for (const n of nodes) {
      n.degree = degree.get(n.id) || 0;
      if (n.type === "mega_mega_node") {
        n.displayLabel = n.rawId;
        n.narrative = n.rawId;
      } else if (n.type === "mega_node") {
        n.displayLabel = n.rawId;
        n.narrative = n.rawId;
        n.parentIds = megaParents.get(n.id) || [];
        n.parentId = n.parentIds[0] ?? null;
      } else {
        n.displayLabel = n.label || `Post: ${n.rawId}`;
        n.parentIds = postParents.get(n.id) || [];
        n.parentId = n.parentIds[0] ?? null;
      }
    }

    // Assign a dull family color per mega_mega; children inherit it
    const parentTopics = nodes
      .filter((n) => n.type === "mega_mega_node")
      .sort((a, b) => a.id - b.id);
    parentTopics.forEach((p, i) => {
      const fill = FAMILY_PALETTE[i % FAMILY_PALETTE.length];
      p.color = fill;
      p.strokeColor = darkenHex(fill, 0.28);
      p.linkColor = hexToRgba(fill, 0.3);
    });

    for (const n of nodes) {
      if (n.type === "mega_node") {
        const parent = n.parentId != null ? byId.get(n.parentId) : null;
        if (parent?.color) {
          n.color = parent.color;
          n.strokeColor = darkenHex(parent.color, 0.2);
          n.linkColor = hexToRgba(parent.color, 0.22);
        } else {
          n.color = COLORS.orphan;
          n.strokeColor = COLORS.orphanStroke;
          n.linkColor = hexToRgba(COLORS.orphan, 0.22);
        }
      } else if (n.type === "regular_node") {
        const mega = n.parentId != null ? byId.get(n.parentId) : null;
        // Posts stay dark gray by default; sentiment/family tint only on selection.
        n.color = COLORS.postFallback;
        n.familyColor = mega?.color ? lightenHex(mega.color, 0.45) : COLORS.postFallback;
      }
    }

    // Parent topics with no narrative children have nothing to cluster / no sentiment posts
    const megaCountByTopic = new Map();
    for (const n of nodes) {
      if (n.type !== "mega_node" || n.parentId == null) continue;
      megaCountByTopic.set(n.parentId, (megaCountByTopic.get(n.parentId) || 0) + 1);
    }
    for (const p of parentTopics) {
      p.hasNarratives = (megaCountByTopic.get(p.id) || 0) > 0;
    }

    state.nodes = nodes;
    state.links = links;
    state.byId = byId;
    state.parentTopics = nodes.filter((n) => n.type === "mega_mega_node");
    state.narratives = nodes.filter((n) => n.type === "mega_node");
    state.posts = nodes.filter((n) => n.type === "regular_node");
    state.structuralNodes = [...state.parentTopics, ...state.narratives];
    state.structuralLinks = links.filter((l) => l.kind === "parent_link");
    state.megasByParent = new Map();
    state.postsByMega = new Map();
    for (const mega of state.narratives) {
      if (mega.parentId == null) continue;
      if (!state.megasByParent.has(mega.parentId)) state.megasByParent.set(mega.parentId, []);
      state.megasByParent.get(mega.parentId).push(mega);
    }
    for (const post of state.posts) {
      if (post.parentId == null) continue;
      if (!state.postsByMega.has(post.parentId)) state.postsByMega.set(post.parentId, []);
      state.postsByMega.get(post.parentId).push(post);
    }
    applyNodeRadii();
  }

  function isExcluded(n) {
    return (
      n?.type === "mega_mega_node" &&
      !n.hasNarratives &&
      !settings.showEmptyTopics
    );
  }

  function activeNodes() {
    return state.nodes.filter((n) => !isExcluded(n));
  }

  function activeStructuralNodes() {
    return state.structuralNodes.filter((n) => !isExcluded(n));
  }

  function activeStructuralLinks() {
    return state.structuralLinks.filter((l) => {
      const s = typeof l.source === "object" ? l.source : state.byId.get(l.source);
      const t = typeof l.target === "object" ? l.target : state.byId.get(l.target);
      return s && t && !isExcluded(s) && !isExcluded(t);
    });
  }

  function seedPositions() {
    const cx = state.width / 2;
    const cy = state.height / 2;
    const parents = state.parentTopics.filter((n) => !isExcluded(n));
    const megas = state.narratives;
    const posts = state.posts;
    const parentById = new Map(parents.map((n) => [n.id, n]));
    const megaById = new Map(megas.map((n) => [n.id, n]));

    refreshClusterExtents();
    // Largest families first so giant post clouds claim space before neighbors pack in
    parents.sort(
      (a, b) => (b.clusterExtent || 0) - (a.clusterExtent || 0) || (b.degree || 0) - (a.degree || 0)
    );
    const placed = [];
    parents.forEach((p, i) => {
      const extent = Math.max(p.clusterExtent || CLUSTER_PITCH * 0.4, CLUSTER_PITCH * 0.35);
      if (i === 0) {
        p.x = cx;
        p.y = cy;
      } else {
        let bestX = cx;
        let bestY = cy;
        let found = false;
        // Golden-angle spiral until this family's disc clears all already-placed parents
        for (let step = 0; step < 2500 && !found; step += 1) {
          const r = extent * 0.35 + step * 10;
          const angle = step * GOLDEN_ANGLE;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          const clear = placed.every((o) => {
            const dx = o.x - x;
            const dy = o.y - y;
            const need = o.extent + extent + FAMILY_COLLIDE_PAD;
            return dx * dx + dy * dy >= need * need;
          });
          if (clear) {
            bestX = x;
            bestY = y;
            found = true;
          }
        }
        p.x = bestX;
        p.y = bestY;
      }
      p.vx = 0;
      p.vy = 0;
      p.fx = null;
      p.fy = null;
      p.userPinned = false;
      placed.push({ x: p.x, y: p.y, extent });
    });

    // Park hidden empty topics off-layout (restored if settings turn them on)
    for (const n of state.nodes) {
      if (n.type === "mega_mega_node" && isExcluded(n)) {
        n.x = cx;
        n.y = cy;
        n.vx = 0;
        n.vy = 0;
        n.fx = null;
        n.fy = null;
      }
    }

    // Group megas by parent topic; orphan megas get a shared fallback pack
    const orphanMegas = [];
    for (const m of megas) {
      if (m.parentId != null && parentById.has(m.parentId)) {
        continue;
      } else {
        orphanMegas.push(m);
      }
    }

    for (const [parentId, group] of state.megasByParent) {
      const parent = parentById.get(parentId);
      if (!parent) continue;
      group.sort((a, b) => (b.childPostCount || b.degree || 0) - (a.childPostCount || a.degree || 0));
      let angleCursor = -Math.PI / 2;
      group.forEach((m, i) => {
        const angle = group.length === 1 ? -Math.PI / 2 : angleCursor;
        // Orbit around the parent hub; posts sit outside the parent disc.
        const dist = parentLinkDistance(parent, m);
        m.x = parent.x + Math.cos(angle) * dist;
        m.y = parent.y + Math.sin(angle) * dist;
        m.vx = 0;
        m.vy = 0;
        m.fx = null;
        m.fy = null;
        const circumferenceShare = Math.max(0.35, (m.cloudRadius || m.radius) / Math.max(1, parent.clusterExtent));
        angleCursor += Math.max(GOLDEN_ANGLE * 0.55, circumferenceShare * Math.PI);
      });
    }

    orphanMegas.sort((a, b) => (b.childPostCount || b.degree || 0) - (a.childPostCount || a.degree || 0));
    orphanMegas.forEach((m, i) => {
      const extent = m.cloudRadius || 80;
      const r = extent + 24 * Math.sqrt(i + 0.5);
      const angle = i * GOLDEN_ANGLE;
      m.x = cx + Math.cos(angle) * r;
      m.y = cy + Math.sin(angle) * r;
      m.vx = 0;
      m.vy = 0;
      m.fx = null;
      m.fy = null;
    });

    for (const post of posts) {
      const parent = post.parentId != null ? megaById.get(post.parentId) : null;
      if (!parent || !Number.isFinite(parent.x)) {
        post.x = cx + (Math.random() - 0.5) * 40;
        post.y = cy + (Math.random() - 0.5) * 40;
        post.localX = post.x - cx;
        post.localY = post.y - cy;
        post.targetLocalX = post.localX;
        post.targetLocalY = post.localY;
        post.vx = 0;
        post.vy = 0;
      }
    }

    for (const [parentId, group] of state.postsByMega) {
      const parent = megaById.get(parentId);
      if (parent) placePostsByStance(parent, group, { immediate: true });
    }
    refreshClusterExtents();
    syncPostWorldPositions();
  }

  // Pack posts around a mega in angular wedges by stance so same-stance posts sit together.
  function placePostsByStance(parent, group, { immediate = false } = {}) {
    const buckets = new Map();
    for (const post of group) {
      const key = stanceKey(post);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(post);
    }
    const order = [...STANCE_ORDER, UNKNOWN_STANCE].filter((k) => buckets.has(k));
    const spacing = postR() * 2 + 2.5;
    const innerRadius = parent.radius + LINK_GAP + postR();
    const rowPitch = spacing * Math.sqrt(3) / 2;
    let outerRadius = innerRadius + spacing;
    let slots = [];

    // Generate a collision-free hex lattice, growing only until every post has a slot.
    while (slots.length < group.length) {
      slots = [];
      const rows = Math.ceil(outerRadius / rowPitch);
      const cols = Math.ceil(outerRadius / spacing) + 1;
      for (let row = -rows; row <= rows; row += 1) {
        const y = row * rowPitch;
        const offsetX = Math.abs(row) % 2 ? spacing / 2 : 0;
        for (let col = -cols; col <= cols; col += 1) {
          const x = col * spacing + offsetX;
          const dist = Math.hypot(x, y);
          if (dist < innerRadius || dist > outerRadius) continue;
          slots.push({ x, y, dist });
        }
      }
      if (slots.length < group.length) outerRadius += spacing;
    }

    // Keep the most compact N slots, then order by angle. Assigning stance buckets
    // consecutively creates wedges without sacrificing lattice separation.
    slots.sort((a, b) => a.dist - b.dist);
    slots = slots.slice(0, group.length);
    slots.sort((a, b) => {
      const aa = (Math.atan2(a.y, a.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      const ba = (Math.atan2(b.y, b.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      return aa - ba || a.dist - b.dist;
    });

    let slotIndex = 0;
    for (const key of order) {
      const bucket = buckets.get(key);
      for (const post of bucket) {
        const slot = slots[slotIndex++];
        post.targetLocalX = slot.x;
        post.targetLocalY = slot.y;
        if (immediate || !Number.isFinite(post.localX) || !Number.isFinite(post.localY)) {
          post.localX = post.targetLocalX;
          post.localY = post.targetLocalY;
        } else if (
          Math.abs(post.targetLocalX - post.localX) > POST_LERP_EPSILON ||
          Math.abs(post.targetLocalY - post.localY) > POST_LERP_EPSILON
        ) {
          state.postsAnimating = true;
        }
        post.x = parent.x + post.localX;
        post.y = parent.y + post.localY;
        post.vx = 0;
        post.vy = 0;
      }
    }
    parent.farthestPostDistance =
      slots.length ? Math.max(...slots.map((slot) => slot.dist)) : parent.radius;
    parent.topicCollisionRadius = parent.farthestPostDistance;
    parent.cloudRadius = parent.farthestPostDistance + postR();
  }

  function layoutAllPosts({ immediate = false } = {}) {
    for (const [megaId, posts] of state.postsByMega) {
      const mega = state.byId.get(megaId);
      if (mega) placePostsByStance(mega, posts, { immediate });
    }
    refreshClusterExtents();
    syncPostWorldPositions();
    if (state.postsAnimating) requestRender();
  }

  function syncPostWorldPositions(advance = false) {
    let animating = false;
    for (const [megaId, posts] of state.postsByMega) {
      const mega = state.byId.get(megaId);
      if (!mega || !Number.isFinite(mega.x) || !Number.isFinite(mega.y)) continue;
      for (const post of posts) {
        if (advance) {
          const dx = (post.targetLocalX ?? post.localX ?? 0) - (post.localX ?? 0);
          const dy = (post.targetLocalY ?? post.localY ?? 0) - (post.localY ?? 0);
          if (Math.abs(dx) > POST_LERP_EPSILON || Math.abs(dy) > POST_LERP_EPSILON) {
            post.localX = (post.localX ?? 0) + dx * POST_LERP;
            post.localY = (post.localY ?? 0) + dy * POST_LERP;
            animating = true;
          } else {
            post.localX = post.targetLocalX ?? post.localX ?? 0;
            post.localY = post.targetLocalY ?? post.localY ?? 0;
          }
        }
        post.x = mega.x + (post.localX || 0);
        post.y = mega.y + (post.localY || 0);
      }
    }
    if (advance) state.postsAnimating = animating;
    return advance ? animating : state.postsAnimating;
  }

  function startSimulation() {
    if (state.simulation) state.simulation.stop();

    const nodes = activeStructuralNodes();

    state.simulation = d3
      .forceSimulation(nodes)
      .alpha(INITIAL_SIMULATION_ALPHA)
      .alphaMin(INITIAL_SIMULATION_ALPHA_MIN)
      .alphaDecay(INITIAL_SIMULATION_ALPHA_DECAY)
      .velocityDecay(INITIAL_SIMULATION_VELOCITY_DECAY)
      // Parent hubs are the sole attractors; bidirectional D3 links are avoided
      // so children cannot pull parents off center.
      .force("parentAttract", forceParentAttract())
      .force(
        "repelFamilies",
        forceFamilyRepel(MEGA_MEGA_REPEL, MEGA_MEGA_REPEL_DIST)
      )
      .force(
        "repelForeignMegas",
        forceForeignClusterRepel({
          type: "mega_node",
          parentKey: "parentId",
          strength: FOREIGN_MEGA_REPEL,
          distanceMax: FOREIGN_MEGA_DIST_MAX,
        })
      )
      .force("familyCollision", forceFamilyCollide())
      .force("topicCollision", forceTopicCollide())
      .on("tick", onTick)
      .on("end", onSimEnd);
  }

  function onTick() {
    syncPostWorldPositions();
    requestRender();
  }

  function onSimEnd() {
    resolveTopicCollisions();
    for (const n of activeStructuralNodes()) {
      n.fx = n.x;
      n.fy = n.y;
      n.vx = 0;
      n.vy = 0;
    }
    state.settleParentIds = null;
    syncPostWorldPositions();
    state.settled = true;
    if (!state.dragging && !state.skipFitOnSimEnd) fitGraphToView();
    state.skipFitOnSimEnd = false;
    requestRender();
  }

  function requestRender() {
    if (state.renderFrame != null) return;
    state.renderFrame = requestAnimationFrame(() => {
      state.renderFrame = null;
      const keepAnimating = syncPostWorldPositions(true);
      render();
      if (keepAnimating) requestRender();
    });
  }

  function getClusterMembers(megaMega) {
    const megas = state.megasByParent.get(megaMega.id) || [];
    const posts = [];
    for (const mega of megas) posts.push(...(state.postsByMega.get(mega.id) || []));
    return { parent: megaMega, megas, posts, all: [megaMega, ...megas, ...posts] };
  }

  function translateCluster(megaMega, dx, dy) {
    const { parent, megas } = getClusterMembers(megaMega);
    for (const n of [parent, ...megas]) {
      n.x += dx;
      n.y += dy;
      if (n.fx != null) n.fx += dx;
      if (n.fy != null) n.fy += dy;
      n.vx = 0;
      n.vy = 0;
    }
    syncPostWorldPositions();
  }

  function pinClusterForDrag(megaMega) {
    const { parent, megas } = getClusterMembers(megaMega);
    for (const n of [parent, ...megas]) {
      n.fx = n.x;
      n.fy = n.y;
      n.vx = 0;
      n.vy = 0;
    }
  }

  function finalizeClusterDrag(megaMega) {
    const { parent, megas } = getClusterMembers(megaMega);
    parent.userPinned = true;
    parent.fx = parent.x;
    parent.fy = parent.y;
    for (const m of megas) {
      m.fx = m.x;
      m.fy = m.y;
      m.vx = 0;
      m.vy = 0;
    }
  }

  function overlappingParentIds(draggedParent) {
    const ids = new Set([draggedParent.id]);
    const draggedR = draggedParent.clusterExtent || draggedParent.radius;
    for (const other of state.parentTopics) {
      if (other === draggedParent || isExcluded(other)) continue;
      const otherR = other.clusterExtent || other.radius;
      const dist = Math.hypot(other.x - draggedParent.x, other.y - draggedParent.y);
      if (dist < draggedR + otherR + FAMILY_COLLIDE_PAD) ids.add(other.id);
    }
    return ids;
  }

  function restartSettleAfterAnchor(draggedParent) {
    state.settled = false;
    state.skipFitOnSimEnd = true;
    if (!state.simulation) {
      startSimulation();
      return;
    }
    state.simulation.stop();
    const affectedParentIds = overlappingParentIds(draggedParent);
    state.settleParentIds = affectedParentIds;

    // Freeze the settled graph. Only the dragged family's narratives and directly
    // overlapping, non-user-anchored families may move during this micro-settle.
    for (const n of activeStructuralNodes()) {
      n.fx = n.x;
      n.fy = n.y;
      n.vx = 0;
      n.vy = 0;
    }
    for (const parentId of affectedParentIds) {
      const parent = state.byId.get(parentId);
      const isDragged = parentId === draggedParent.id;
      if (!isDragged && parent && !parent.userPinned) {
        parent.fx = null;
        parent.fy = null;
      }
      if (isDragged || !parent?.userPinned) {
        for (const mega of state.megasByParent.get(parentId) || []) {
          mega.fx = null;
          mega.fy = null;
        }
      }
    }

    // No spatial conflict: preserve every settled coordinate and skip physics.
    if (affectedParentIds.size === 1) {
      for (const mega of state.megasByParent.get(draggedParent.id) || []) {
        mega.fx = mega.x;
        mega.fy = mega.y;
      }
      state.settleParentIds = null;
      state.settled = true;
      state.skipFitOnSimEnd = false;
      requestRender();
      return;
    }

    const nodes = activeStructuralNodes();
    state.simulation.nodes(nodes);
    state.simulation.force("parentAttract")?.initialize?.(nodes);
    state.simulation.force("topicCollision")?.initialize?.(nodes);
    state.simulation.force("familyCollision")?.initialize?.(nodes);
    state.simulation.force("repelFamilies")?.initialize?.(nodes);
    state.simulation.force("repelForeignMegas")?.initialize?.(nodes);
    state.simulation.alpha(LOCAL_SETTLE_ALPHA).alphaDecay(0.09).restart();
  }

  function fitGraphToView() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of activeNodes()) {
      const r = nodeRadius(n);
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      minX = Math.min(minX, n.x - r);
      minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r);
      maxY = Math.max(maxY, n.y + r);
    }
    if (!Number.isFinite(minX)) return;

    const panelBleed = panelBleedWidth();
    const leftBleed = settingsBleedWidth();
    const pad = 56;
    const usableW = Math.max(120, state.width - panelBleed - leftBleed);
    const gw = maxX - minX || 1;
    const gh = maxY - minY || 1;
    const k = Math.min(
      (usableW - pad * 2) / gw,
      (state.height - pad * 2) / gh,
      3.5
    );
    const tx = leftBleed + usableW / 2 - k * ((minX + maxX) / 2);
    const ty = state.height / 2 - k * ((minY + maxY) / 2);
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    state.baselineZoom = k;
    state.transform = t;
    if (zoomBehavior) {
      d3.select(canvas).call(zoomBehavior.transform, t);
    }
    updateZoomDisplay();
  }

  function updateZoomDisplay() {
    const rel = state.transform.k / (state.baselineZoom || 1);
    zoomLabel.textContent = `${Math.round(rel * 100)}%`;
  }

  function truncateLabel(text, maxChars) {
    if (!text) return "";
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars - 1)}…`;
  }

  function getPostsForMega(mega) {
    return state.postsByMega.get(mega.id) || [];
  }

  function getMegasForTopic(topic) {
    return state.megasByParent.get(topic.id) || [];
  }

  function getPostsForTopic(topic) {
    const posts = [];
    for (const mega of getMegasForTopic(topic)) {
      posts.push(...getPostsForMega(mega));
    }
    return posts;
  }

  function postsMatchingStance(posts, stance) {
    if (!stance) return posts;
    return posts.filter((p) => stanceKey(p) === stance);
  }

  function narrativeSortMeta(mega) {
    const posts = getPostsForMega(mega);
    const counts = Object.create(null);
    for (const s of NARRATIVE_SORT_STANCES) counts[s] = 0;
    for (const p of posts) {
      const k = stanceKey(p);
      if (k in counts) counts[k] += 1;
    }
    let dominant = null;
    let dominantCount = 0;
    for (const s of NARRATIVE_SORT_STANCES) {
      if (counts[s] > dominantCount) {
        dominant = s;
        dominantCount = counts[s];
      }
    }
    return {
      posts,
      counts,
      dominant,
      dominantCount,
      orderIdx: dominant != null ? NARRATIVE_SORT_STANCES.indexOf(dominant) : NARRATIVE_SORT_STANCES.length,
    };
  }

  function sortMegasByPoliticalStance(megas) {
    return megas.slice().sort((a, b) => {
      const ma = narrativeSortMeta(a);
      const mb = narrativeSortMeta(b);
      if (ma.orderIdx !== mb.orderIdx) return ma.orderIdx - mb.orderIdx;
      if (mb.dominantCount !== ma.dominantCount) return mb.dominantCount - ma.dominantCount;
      const da = mb.posts.length - ma.posts.length;
      if (da) return da;
      return String(a.rawId).localeCompare(String(b.rawId), undefined, { numeric: true });
    });
  }

  function applyStanceFilterHighlights(anchor, posts, megas) {
    const filteredPosts = postsMatchingStance(posts, state.stanceFilter);
    const ids = new Set([anchor.id, ...filteredPosts.map((p) => p.id)]);
    if (megas) {
      for (const mega of megas) {
        const megaPosts = postsMatchingStance(getPostsForMega(mega), state.stanceFilter);
        if (!state.stanceFilter || megaPosts.length) ids.add(mega.id);
      }
    }
    state.highlightIds = ids;
    return filteredPosts;
  }

  function panelBleedWidth() {
    return panelEl && !panelEl.hidden ? Math.min(PANEL_MAX_W, window.innerWidth * 0.92) : 0;
  }

  function settingsBleedWidth() {
    return settingsEl && !settingsEl.hidden ? Math.min(300, window.innerWidth * 0.92) : 0;
  }

  function applySettingsLive({ visibilityChanged = false } = {}) {
    applyNodeRadii();
    layoutAllPosts({ immediate: visibilityChanged });
    if (state.simulation) {
      if (visibilityChanged) {
        seedPositions();
        startSimulation();
        state.settled = false;
        state.skipFitOnSimEnd = false;
      } else {
        const nodes = activeStructuralNodes();
        for (const n of nodes) {
          if (n.type === "mega_mega_node" && n.userPinned) continue;
          n.fx = null;
          n.fy = null;
        }
        state.simulation.force("parentAttract")?.initialize?.(nodes);
        state.simulation.force("topicCollision")?.initialize?.(nodes);
        state.simulation.force("familyCollision")?.initialize?.(nodes);
        state.simulation.force("repelFamilies")?.initialize?.(nodes);
        state.simulation.force("repelForeignMegas")?.initialize?.(nodes);
        state.settled = false;
        state.simulation.alpha(0.22).alphaDecay(0.065).restart();
      }
    }
    requestRender();
  }

  function syncSettingControls(key) {
    if (key === "showEmptyTopics") {
      const box = document.getElementById("set-showEmptyTopics");
      if (box) box.checked = Boolean(settings.showEmptyTopics);
      return;
    }
    const range = document.getElementById(`set-${key}`);
    const num = document.getElementById(`num-${key}`);
    if (!range || !num) return;
    const display =
      key === "postSize"
        ? Math.round(settings[key] * 100) / 100
        : settings[key];
    range.value = String(display);
    num.value = String(display);
  }

  function syncAllSettingControls() {
    for (const key of ["topicSize", "narrativeSize", "postSize", "showEmptyTopics"]) {
      syncSettingControls(key);
    }
  }

  function setSettingFromUi(key, rawValue) {
    if (key === "showEmptyTopics") {
      settings.showEmptyTopics = Boolean(rawValue);
      syncSettingControls(key);
      applySettingsLive({ visibilityChanged: true });
      return;
    }

    let value = Number(rawValue);
    if (!Number.isFinite(value)) return;

    if (key === "topicSize") {
      value = Math.max(12, Math.min(80, Math.round(value)));
    } else if (key === "narrativeSize") {
      value = Math.max(6, Math.min(48, Math.round(value)));
    } else if (key === "postSize") {
      value = Math.max(1, Math.min(12, Math.round(value * 4) / 4));
    } else {
      return;
    }

    settings[key] = value;
    syncSettingControls(key);
    applySettingsLive();
  }

  function setSettingsOpen(open) {
    if (!settingsEl) return;
    settingsEl.hidden = !open;
    document.body.classList.toggle("settings-open", open);
    settingsToggle?.setAttribute("aria-expanded", open ? "true" : "false");
    if (state.settled) fitGraphToView();
    render();
  }

  function setupSettings() {
    if (!settingsEl) return;
    setSettingsOpen(false);
    syncAllSettingControls();

    const bindPair = (key) => {
      const range = document.getElementById(`set-${key}`);
      const num = document.getElementById(`num-${key}`);
      if (!range || !num) return;
      range.addEventListener("input", () => setSettingFromUi(key, range.value));
      num.addEventListener("change", () => setSettingFromUi(key, num.value));
      num.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setSettingFromUi(key, num.value);
          num.blur();
        }
      });
    };

    for (const key of ["topicSize", "narrativeSize", "postSize"]) {
      bindPair(key);
    }

    const emptyToggle = document.getElementById("set-showEmptyTopics");
    emptyToggle?.addEventListener("change", () => {
      setSettingFromUi("showEmptyTopics", emptyToggle.checked);
    });

    settingsToggle?.addEventListener("click", () => {
      setSettingsOpen(!!settingsEl.hidden);
    });
    settingsClose?.addEventListener("click", () => setSettingsOpen(false));
    settingsReset?.addEventListener("click", () => {
      const visibilityChanged =
        settings.showEmptyTopics !== SETTINGS_DEFAULTS.showEmptyTopics;
      Object.assign(settings, SETTINGS_DEFAULTS);
      syncAllSettingControls();
      applySettingsLive({ visibilityChanged });
    });
  }

  function showPanelShell(title) {
    panelTitle.textContent = title;
    document.body.classList.add("panel-open");
    panelEl.hidden = false;
    panelEl.setAttribute("aria-hidden", "false");
  }

  function appendPanelHero(parent, title, meta) {
    const wrap = document.createElement("div");
    wrap.className = "panel-hero panel-field";
    const heading = document.createElement("h3");
    heading.className = "panel-hero-title";
    heading.textContent = title;
    wrap.appendChild(heading);
    if (meta) {
      const metaEl = document.createElement("div");
      metaEl.className = "panel-hero-meta";
      metaEl.textContent = meta;
      wrap.appendChild(metaEl);
    }
    parent.appendChild(wrap);
    return wrap;
  }

  function appendField(parent, label, valueEl) {
    const field = document.createElement("div");
    field.className = "panel-field";
    const lab = document.createElement("div");
    lab.className = "panel-label";
    lab.textContent = label;
    field.appendChild(lab);
    field.appendChild(valueEl);
    parent.appendChild(field);
    return field;
  }

  function makeValue(text, mono = false) {
    const el = document.createElement("div");
    el.className = mono ? "panel-value mono" : "panel-value";
    el.textContent = text;
    return el;
  }

  function makeNavCard({ title, meta, hint, color, onClick }) {
    const card = document.createElement(onClick ? "button" : "div");
    if (onClick) {
      card.type = "button";
      card.className = "narrative-card narrative-card-btn";
      card.addEventListener("click", onClick);
    } else {
      card.className = "narrative-card";
    }
    if (color) card.style.borderLeft = `4px solid ${color}`;

    const titleEl = document.createElement("div");
    titleEl.className = "narrative-card-title";
    titleEl.textContent = title;
    card.appendChild(titleEl);

    if (meta) {
      const metaEl = document.createElement("div");
      metaEl.className = "narrative-card-meta";
      metaEl.textContent = meta;
      card.appendChild(metaEl);
    }

    if (hint && onClick) {
      const hintEl = document.createElement("div");
      hintEl.className = "narrative-card-hint";
      hintEl.textContent = hint;
      card.appendChild(hintEl);
    }

    return card;
  }

  function focusNodes(nodes) {
    const items = (nodes || []).filter((n) => n && Number.isFinite(n.x) && Number.isFinite(n.y));
    if (!items.length || !zoomBehavior) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of items) {
      const r = Math.max(nodeRadius(n), 8);
      minX = Math.min(minX, n.x - r);
      minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r);
      maxY = Math.max(maxY, n.y + r);
    }

    const bleed = panelBleedWidth();
    const leftBleed = settingsBleedWidth();
    const pad = 72;
    const usableW = Math.max(120, state.width - bleed - leftBleed);
    const gw = Math.max(maxX - minX, 40);
    const gh = Math.max(maxY - minY, 40);
    const k = Math.min(
      (usableW - pad * 2) / gw,
      (state.height - pad * 2) / gh,
      Math.max(state.baselineZoom || 1, 1) * 4.5
    );
    const tx = leftBleed + usableW / 2 - k * ((minX + maxX) / 2);
    const ty = state.height / 2 - k * ((minY + maxY) / 2);
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);

    d3.select(canvas)
      .transition()
      .duration(420)
      .ease(d3.easeCubicOut)
      .call(zoomBehavior.transform, t);
  }

  function makeStanceBadge(stance) {
    const el = document.createElement("span");
    el.className = "stance-badge";
    const key = stance && STANCE_COLORS[stance] ? stance : UNKNOWN_STANCE;
    el.style.setProperty("--stance-color", stanceColor(key));
    el.textContent = key === UNKNOWN_STANCE ? "No sentiment" : (STANCE_LABELS[key] || key);
    return el;
  }

  function makeLink(href, label) {
    const a = document.createElement("a");
    a.className = "panel-link";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label || href;
    return a;
  }

  function appendStanceDistribution(parent, posts, { onFilterChange } = {}) {
    const { total, entries } = computeStanceDistribution(posts);
    const wrap = document.createElement("div");
    wrap.className = "stance-dist";

    const count = document.createElement("div");
    count.className = "panel-count";
    const filtered = state.stanceFilter
      ? postsMatchingStance(posts, state.stanceFilter).length
      : total;
    count.textContent = state.stanceFilter
      ? `${filtered} of ${total} post${total === 1 ? "" : "s"} · filtered`
      : `${total} post${total === 1 ? "" : "s"}`;
    wrap.appendChild(count);

    const bar = document.createElement("div");
    bar.className = "stance-bar";
    bar.setAttribute("role", "img");
    bar.setAttribute(
      "aria-label",
      entries.map((e) => `${e.label} ${e.percentage}%`).join(", ")
    );
    for (const e of entries) {
      if (!e.post_count) continue;
      const seg = document.createElement("div");
      seg.className = "stance-bar-seg";
      seg.style.width = `${e.percentage}%`;
      seg.style.background = e.color;
      seg.title = `${e.label}: ${e.post_count} (${e.percentage}%)`;
      if (state.stanceFilter && state.stanceFilter !== e.stance) {
        seg.style.opacity = "0.28";
      }
      bar.appendChild(seg);
    }
    if (![...bar.children].length) {
      const empty = document.createElement("div");
      empty.className = "stance-bar-seg";
      empty.style.width = "100%";
      empty.style.background = COLORS.postNoData;
      bar.appendChild(empty);
    }
    wrap.appendChild(bar);

    const legend = document.createElement("div");
    legend.className = "stance-legend";
    for (const e of entries) {
      if (!e.post_count) continue;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "stance-legend-row";
      if (state.stanceFilter === e.stance) row.classList.add("is-active");
      else if (state.stanceFilter) row.classList.add("is-dimmed");
      row.title = state.stanceFilter === e.stance
        ? "Click to clear filter"
        : `Filter to ${e.label}`;
      row.setAttribute("aria-pressed", state.stanceFilter === e.stance ? "true" : "false");

      const swatch = document.createElement("span");
      swatch.className = "stance-swatch";
      swatch.style.background = e.color;
      row.appendChild(swatch);

      const name = document.createElement("span");
      name.className = "stance-legend-name";
      name.textContent = e.label;
      row.appendChild(name);

      const meta = document.createElement("span");
      meta.className = "stance-legend-meta";
      meta.textContent = `${e.post_count} · ${e.percentage}%`;
      row.appendChild(meta);

      row.addEventListener("click", () => {
        state.stanceFilter = state.stanceFilter === e.stance ? null : e.stance;
        if (typeof onFilterChange === "function") onFilterChange(state.stanceFilter);
      });

      legend.appendChild(row);
    }
    wrap.appendChild(legend);

    if (typeof onFilterChange === "function") {
      const hint = document.createElement("div");
      hint.className = "stance-filter-hint";
      hint.textContent = state.stanceFilter
        ? "Click the active sentiment again to clear"
        : "Click a sentiment to filter the graph and list";
      wrap.appendChild(hint);
    }

    appendField(parent, "Sentiment distribution", wrap);
  }

  function openPostPanel(post) {
    state.stanceFilter = null;
    state.selected = post;
    state.highlightIds = new Set([post.id]);
    showPanelShell("Post");
    panelBody.replaceChildren();

    appendPanelHero(panelBody, post.rawId);

    const s = post.sentiment;
    if (s) {
      const stanceWrap = document.createElement("div");
      stanceWrap.className = "stance-inline";
      stanceWrap.appendChild(makeStanceBadge(s.stance));
      if (s.polarity) {
        const pol = document.createElement("span");
        pol.className = "stance-inline-meta";
        pol.textContent = `Polarity: ${s.polarity}`;
        stanceWrap.appendChild(pol);
      }
      if (s.tone) {
        const tone = document.createElement("span");
        tone.className = "stance-inline-meta";
        tone.textContent = `Tone: ${s.tone}`;
        stanceWrap.appendChild(tone);
      }
      appendField(panelBody, "Sentiment", stanceWrap);

      if (s.content_snippet) {
        const snippet = makeValue(s.content_snippet);
        snippet.classList.add("panel-snippet");
        appendField(panelBody, "Content", snippet);
      }

      const narrativeText = s.post_narrative || s.sentiment_reasoning;
      if (narrativeText) {
        appendField(
          panelBody,
          s.post_narrative ? "Post narrative" : "Sentiment reasoning",
          makeValue(narrativeText)
        );
      }

      if (s.subjects) {
        appendField(panelBody, "Subjects", makeValue(s.subjects));
      }
      if (s.primary_subject_actions) {
        appendField(panelBody, "Actions", makeValue(s.primary_subject_actions));
      }
      if (s.violations || s.violations_str) {
        appendField(
          panelBody,
          "Violations",
          makeValue(s.violations_str || s.violations)
        );
      }

      const metaBits = [];
      if (s.target) metaBits.push(["Target", s.target]);
      if (s.sentiment_confidence) metaBits.push(["Confidence", s.sentiment_confidence]);
      if (s.speech_type) metaBits.push(["Speech type", s.speech_type]);
      if (s.intent) metaBits.push(["Intent", s.intent]);
      if (s.intensity_label || s.intensity_score) {
        metaBits.push([
          "Intensity",
          [s.intensity_label, s.intensity_score].filter(Boolean).join(" · "),
        ]);
      }
      if (s.primary_score_label || s.primary_score) {
        metaBits.push([
          "Severity",
          [s.primary_score_label, s.primary_score].filter(Boolean).join(" · "),
        ]);
      }
      if (s.negative_severity_score) {
        metaBits.push(["Neg. severity", s.negative_severity_score]);
      }
      if (s.subtopic) metaBits.push(["Subtopic", s.subtopic]);
      if (s.parent_topic) metaBits.push(["Parent topic", s.parent_topic]);
      if (s.topic) metaBits.push(["Topic", s.topic]);
      if (s.keyword) metaBits.push(["Keyword", s.keyword]);
      if (s.platform) metaBits.push(["Platform", s.platform]);
      if (s.protected_expression) {
        metaBits.push(["Protected expression", s.protected_expression]);
      }
      if (metaBits.length) {
        const grid = document.createElement("div");
        grid.className = "meta-grid";
        for (const [lab, val] of metaBits) {
          const cell = document.createElement("div");
          cell.className = "meta-cell";
          const k = document.createElement("div");
          k.className = "meta-key";
          k.textContent = lab;
          const v = document.createElement("div");
          v.className = "meta-val";
          v.textContent = val;
          cell.appendChild(k);
          cell.appendChild(v);
          grid.appendChild(cell);
        }
        appendField(panelBody, "Details", grid);
      }

      if (s.url) {
        appendField(panelBody, "URL", makeLink(s.url, s.url));
      }
    } else {
      if (post.displayLabel && post.displayLabel !== post.rawId) {
        appendField(panelBody, "Label", makeValue(post.displayLabel));
      }
      appendField(panelBody, "Sentiment", makeValue("No matching sentiment row for this post id."));
    }

    const narrativesWrap = document.createElement("div");
    narrativesWrap.className = "panel-narratives";
    const parentIds = post.parentIds || (post.parentId != null ? [post.parentId] : []);
    if (parentIds.length === 0) {
      narrativesWrap.appendChild(makeValue("No linked narrative."));
    } else {
      for (const megaId of parentIds) {
        const mega = state.byId.get(megaId);
        const topicParents = mega?.parentIds || [];
        const topicNames = topicParents
          .map((id) => state.byId.get(id))
          .filter(Boolean)
          .map((t) => t.rawId)
          .join(", ");
        narrativesWrap.appendChild(
          makeNavCard({
            title: mega ? mega.narrative || mega.rawId : String(megaId),
            meta: topicNames ? `Parent topic: ${topicNames}` : mega?.label || null,
            hint: mega ? "Open narrative →" : null,
            color: mega?.color || null,
            onClick: mega ? () => openMegaPanel(mega) : null,
          })
        );
      }
    }
    appendField(panelBody, "Narrative", narrativesWrap);
    render();
  }

  function openMegaPanel(mega, { keepFilter = false } = {}) {
    if (!keepFilter) state.stanceFilter = null;
    const allPosts = getPostsForMega(mega);
    state.selected = mega;
    applyStanceFilterHighlights(mega, allPosts, null);
    showPanelShell("Narrative");
    panelBody.replaceChildren();

    appendPanelHero(panelBody, mega.rawId || mega.displayLabel || "—");

    const topicsWrap = document.createElement("div");
    topicsWrap.className = "panel-narratives";
    const topicIds = mega.parentIds || (mega.parentId != null ? [mega.parentId] : []);
    if (!topicIds.length) {
      topicsWrap.appendChild(makeValue("No parent topic."));
    } else {
      for (const tid of topicIds) {
        const topic = state.byId.get(tid);
        topicsWrap.appendChild(
          makeNavCard({
            title: topic ? topic.rawId : String(tid),
            meta: topic?.label && topic.label !== topic.rawId ? topic.label : null,
            hint: topic ? "Open parent topic →" : null,
            color: topic?.color || mega.color || null,
            onClick: topic ? () => openMegaMegaPanel(topic) : null,
          })
        );
      }
    }
    appendField(panelBody, "Parent topic", topicsWrap);

    appendStanceDistribution(panelBody, allPosts, {
      onFilterChange: () => openMegaPanel(mega, { keepFilter: true }),
    });

    const posts = postsMatchingStance(allPosts, state.stanceFilter);
    const postsField = document.createElement("div");
    postsField.className = "panel-field";
    const postsLab = document.createElement("div");
    postsLab.className = "panel-label";
    postsLab.textContent = state.stanceFilter
      ? `Posts (${posts.length} filtered)`
      : "Posts";
    postsField.appendChild(postsLab);

    const postsWrap = document.createElement("div");
    postsWrap.className = "panel-posts";
    if (!posts.length) {
      postsWrap.appendChild(makeValue(state.stanceFilter ? "No posts for this sentiment." : "No linked posts."));
    } else {
      const sorted = posts.slice().sort((a, b) => {
        const sa = a.stanceIndex ?? 999;
        const sb = b.stanceIndex ?? 999;
        if (sa !== sb) return sa - sb;
        return String(a.rawId).localeCompare(String(b.rawId), undefined, { numeric: true });
      });
      for (const post of sorted) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "post-card post-card-btn";
        const sk = stanceKey(post);
        card.style.borderLeftColor = stanceColor(sk);
        card.addEventListener("click", () => openPostPanel(post));

        const top = document.createElement("div");
        top.className = "post-card-top";
        top.appendChild(makeStanceBadge(post.stance));
        card.appendChild(top);

        const idEl = document.createElement("div");
        idEl.className = "post-card-id";
        idEl.textContent = post.rawId;
        card.appendChild(idEl);

        const title = document.createElement("div");
        title.className = "post-card-title";
        const snippet = post.sentiment?.content_snippet;
        title.textContent = snippet
          ? truncateLabel(snippet, 110)
          : (post.displayLabel || post.label || post.rawId);
        card.appendChild(title);

        postsWrap.appendChild(card);
      }
    }
    postsField.appendChild(postsWrap);
    panelBody.appendChild(postsField);

    render();
    if (!keepFilter) focusNodes([mega, ...posts]);
  }

  function openMegaMegaPanel(topic, { keepFilter = false } = {}) {
    if (!keepFilter) state.stanceFilter = null;
    const megas = getMegasForTopic(topic);
    const allPosts = getPostsForTopic(topic);
    state.selected = topic;
    const filteredPosts = applyStanceFilterHighlights(topic, allPosts, megas);
    showPanelShell("Parent topic");
    panelBody.replaceChildren();

    const topicTitle = topic.rawId || topic.displayLabel || "—";
    const topicMeta =
      topic.label && topic.label !== topicTitle && !topic.label.endsWith(topicTitle)
        ? topic.label
        : null;
    appendPanelHero(panelBody, topicTitle, topicMeta);

    appendStanceDistribution(panelBody, allPosts, {
      onFilterChange: () => openMegaMegaPanel(topic, { keepFilter: true }),
    });

    const visibleMegas = sortMegasByPoliticalStance(megas).filter((mega) => {
      if (!state.stanceFilter) return true;
      return postsMatchingStance(getPostsForMega(mega), state.stanceFilter).length > 0;
    });

    const subsField = document.createElement("div");
    subsField.className = "panel-field";
    const subsLab = document.createElement("div");
    subsLab.className = "panel-label";
    subsLab.textContent = state.stanceFilter
      ? `Narratives (${visibleMegas.length} of ${megas.length})`
      : `Narratives (${megas.length})`;
    subsField.appendChild(subsLab);

    const sortNote = document.createElement("div");
    sortNote.className = "stance-filter-hint";
    sortNote.textContent = "Sorted by dominant sentiment: pro-gov → pro-CJP → anti-CJP → anti-gov";
    subsField.appendChild(sortNote);

    const subsWrap = document.createElement("div");
    subsWrap.className = "panel-narratives";
    if (!visibleMegas.length) {
      subsWrap.appendChild(makeValue(state.stanceFilter ? "No narratives for this sentiment." : "No linked narratives."));
    } else {
      for (const mega of visibleMegas) {
        const meta = narrativeSortMeta(mega);
        const matching = postsMatchingStance(meta.posts, state.stanceFilter);
        const postCount = matching.length;
        const stanceHint = meta.dominant
          ? `${STANCE_LABELS[meta.dominant] || meta.dominant} · ${meta.dominantCount}`
          : "No political sentiment";
        subsWrap.appendChild(
          makeNavCard({
            title: mega.narrative || mega.rawId || mega.displayLabel,
            meta: `${postCount} post${postCount === 1 ? "" : "s"} · ${stanceHint}`,
            hint: "Open narrative →",
            color: meta.dominant ? stanceColor(meta.dominant) : (mega.color || topic.color || null),
            onClick: () => openMegaPanel(mega),
          })
        );
      }
    }
    subsField.appendChild(subsWrap);
    panelBody.appendChild(subsField);

    render();
    if (!keepFilter) focusNodes([topic, ...visibleMegas, ...filteredPosts]);
  }

  function closePanel() {
    if (!state.selected && panelEl.hidden) return;
    state.selected = null;
    state.highlightIds = null;
    state.stanceFilter = null;
    document.body.classList.remove("panel-open");
    panelEl.hidden = true;
    panelEl.setAttribute("aria-hidden", "true");
    panelBody.replaceChildren();
    render();
  }

  function isHighlighted(n) {
    return state.highlightIds != null && state.highlightIds.has(n.id);
  }

  function megaFocusActive() {
    const t = state.selected?.type;
    return (
      (t === "mega_node" || t === "mega_mega_node") &&
      state.highlightIds != null &&
      state.highlightIds.size > 0
    );
  }

  // Stance-tinted posts when a narrative is focused, a stance filter is on, or a single post is selected.
  function stancePostHighlightActive() {
    if (state.stanceFilter && megaFocusActive()) return true;
    if (!megaFocusActive() && state.selected?.type !== "regular_node") return false;
    return state.selected?.type === "mega_node" || state.selected?.type === "regular_node";
  }

  function drawNodeCircle(n, fill, stroke, strokeWidth) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }

  function linkEndpoint(endpoint) {
    return typeof endpoint === "object" ? endpoint : state.byId.get(endpoint);
  }

  function render() {
    const { width, height, transform: t } = state;
    const focusing = megaFocusActive();
    const viewPad = 80 / t.k;
    const view = {
      left: -t.x / t.k - viewPad,
      right: (width - t.x) / t.k + viewPad,
      top: -t.y / t.k - viewPad,
      bottom: (height - t.y) / t.k + viewPad,
    };
    const visible = (n, extra = 0) =>
      n.x + extra >= view.left &&
      n.x - extra <= view.right &&
      n.y + extra >= view.top &&
      n.y - extra <= view.bottom;
    ctx.save();
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // Links — structural edge color; reinforce related links while focusing
    ctx.lineWidth = 1.25 / t.k;
    for (const l of state.structuralLinks) {
      const s = linkEndpoint(l.source);
      const tg = linkEndpoint(l.target);
      if (!s || !tg || !Number.isFinite(s.x) || !Number.isFinite(tg.x)) continue;
      if (isExcluded(s) || isExcluded(tg)) continue;
      if (!visible(s, s.radius) && !visible(tg, tg.radius)) continue;
      const related = focusing && (isHighlighted(s) || isHighlighted(tg));
      let color = COLORS.edge;
      if (focusing && !related) {
        color = hexToRgba(COLORS.edge, COLORS.dimAlpha * 0.7);
      } else if (related) {
        color = hexToRgba(COLORS.mutedText, 0.45);
      }
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tg.x, tg.y);
      ctx.stroke();
    }

    const relativeZoom = t.k / (state.baselineZoom || 1);
    const showPostLinks = focusing || relativeZoom >= 1.8;
    if (showPostLinks) {
      ctx.lineWidth = 1 / t.k;
      for (const l of state.links) {
        if (l.kind === "parent_link") continue;
        const s = linkEndpoint(l.source);
        const tg = linkEndpoint(l.target);
        if (!s || !tg || !Number.isFinite(s.x) || !Number.isFinite(tg.x)) continue;
        if (!visible(s, postR()) && !visible(tg, tg.radius || postR())) continue;
        const related = focusing && isHighlighted(s) && isHighlighted(tg);
        let color = COLORS.edge;
        if (focusing && !related) {
          color = hexToRgba(COLORS.edge, COLORS.dimAlpha * 0.65);
        } else if (related) {
          color = hexToRgba(COLORS.mutedText, 0.55);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = (related ? 1.75 : 1) / t.k;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tg.x, tg.y);
        ctx.stroke();
      }
    }

    // Posts — muted at rest; Civic Signal fill when narrative/post selection highlights stance
    const stanceHighlight = stancePostHighlightActive();
    for (const n of state.posts) {
      if (isExcluded(n) || !Number.isFinite(n.x)) continue;
      if (!visible(n, postR() + 2)) continue;
      const selected = isHighlighted(n);
      const dimmed = focusing && !selected;
      const sk = stanceKey(n);
      const sc = stanceColor(sk);
      const hasStance = sk && sk !== UNKNOWN_STANCE && STANCE_COLORS[sk];
      const showStance =
        stanceHighlight &&
        selected &&
        (state.selected?.type === "mega_node" ||
          state.selected === n ||
          (state.stanceFilter && state.selected?.type === "mega_mega_node"));
      const r = focusing && selected ? postR() + 1.75 : selected || state.selected === n ? postR() + 1 : postR();
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      if (dimmed) {
        ctx.fillStyle = hexToRgba(COLORS.postFallback, COLORS.dimAlpha);
      } else if (showStance) {
        ctx.fillStyle = hasStance ? sc : COLORS.postNoData;
      } else {
        ctx.fillStyle = COLORS.postFallback;
      }
      ctx.fill();
      if (showStance) {
        ctx.strokeStyle = hasStance ? sc : COLORS.selectionRing;
        ctx.lineWidth = 2.25 / t.k;
        ctx.stroke();
      } else if (state.selected === n) {
        ctx.strokeStyle = COLORS.selectionRing;
        ctx.lineWidth = 1.75 / t.k;
        ctx.stroke();
      }
    }

    const showLabels = t.k >= (state.baselineZoom || 1) * LABEL_ZOOM_MULT;
    const fontSize = 11 / t.k;
    const placedLabels = [];

    function labelFits(sx, sy, w, h) {
      const pad = 4;
      const left = sx - w / 2 - pad;
      const right = sx + w / 2 + pad;
      const top = sy - h / 2 - pad;
      const bottom = sy + h / 2 + pad;
      for (const box of placedLabels) {
        if (left < box.right && right > box.left && top < box.bottom && bottom > box.top) {
          return false;
        }
      }
      placedLabels.push({ left, right, top, bottom });
      return true;
    }

    function drawNodeLabel(n, text, maxChars, weight, size) {
      if (!showLabels || !Number.isFinite(n.x)) return;
      const label = truncateLabel(text, maxChars);
      ctx.font = `${weight} ${size}px "Segoe UI", system-ui, sans-serif`;
      const metrics = ctx.measureText(label);
      const w = metrics.width;
      const h = size;
      // Prefer label above the node so it sits in clear space
      const offsets = [
        [0, -(n.radius + h * 0.85)],
        [0, n.radius + h * 0.85],
        [0, 0],
      ];
      for (const [ox, oy] of offsets) {
        const wx = n.x + ox;
        const wy = n.y + oy;
        const sx = wx * t.k + t.x;
        const sy = wy * t.k + t.y;
        if (!labelFits(sx, sy, w * t.k, h * t.k)) continue;
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, wx, wy);
        return;
      }
    }

    // Megas — inherit family color from parent topic
    for (const n of state.narratives) {
      if (isExcluded(n) || !Number.isFinite(n.x)) continue;
      if (!visible(n, n.cloudRadius || n.radius)) continue;
      const hovered = state.hovered === n;
      const selected = isHighlighted(n);
      const dimmed = focusing && !selected;
      const fill = dimmed
        ? hexToRgba(n.color || COLORS.orphan, COLORS.dimAlpha)
        : (n.color || COLORS.orphan);
      const stroke = selected
        ? COLORS.selectionRing
        : hovered
          ? COLORS.hoverStroke
          : (n.strokeColor || COLORS.orphanStroke);
      const strokeW = (selected ? 3.5 : hovered ? 2.5 : 1.25) / t.k;
      drawNodeCircle(n, fill, stroke, strokeW);
      if (selected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 4 / t.k, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.selectionRing;
        ctx.lineWidth = 1.25 / t.k;
        ctx.setLineDash([3 / t.k, 2.5 / t.k]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (!dimmed) {
        drawNodeLabel(n, n.displayLabel, MEGA_LABEL_MAX_CHARS, "600", fontSize);
      }
    }

    // Mega-megas (draw on top)
    for (const n of state.parentTopics) {
      if (isExcluded(n) || !Number.isFinite(n.x)) continue;
      if (!visible(n, n.radius)) continue;
      const hovered = state.hovered === n;
      const selected = isHighlighted(n) || state.selected === n;
      const dimmed = focusing && !selected;
      const fill = dimmed
        ? hexToRgba(n.color || COLORS.orphan, COLORS.dimAlpha)
        : (n.color || COLORS.orphan);
      const stroke = selected
        ? COLORS.selectionRing
        : hovered
          ? COLORS.hoverStroke
          : (n.strokeColor || COLORS.orphanStroke);
      const strokeW = (selected ? 3.5 : hovered ? 3 : 1.5) / t.k;
      drawNodeCircle(n, fill, stroke, strokeW);
      if (selected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 5 / t.k, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.selectionRing;
        ctx.lineWidth = 1.25 / t.k;
        ctx.setLineDash([4 / t.k, 3 / t.k]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (!dimmed) {
        drawNodeLabel(
          n,
          n.displayLabel,
          MEGA_MEGA_LABEL_MAX_CHARS,
          "700",
          MEGA_MEGA_LABEL_SIZE
        );
      }
    }

    // Anchor indicator on user-pinned parent topics
    for (const n of state.parentTopics) {
      if (!n.userPinned || !Number.isFinite(n.x) || !visible(n, n.radius)) continue;
      if (state.selected === n) continue; // selection ring already drawn
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius + 3 / t.k, 0, Math.PI * 2);
      const dimmed = focusing && !isHighlighted(n);
      ctx.strokeStyle = dimmed ? hexToRgba(COLORS.text, COLORS.dimAlpha + 0.2) : COLORS.text;
      ctx.lineWidth = 1.5 / t.k;
      ctx.setLineDash([4 / t.k, 3 / t.k]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (state.hovered && state.hovered.type === "regular_node") {
      const n = state.hovered;
      ctx.beginPath();
      ctx.arc(n.x, n.y, postR() + 1.5 / t.k, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.hoverStroke;
      ctx.lineWidth = 1.5 / t.k;
      ctx.stroke();
    }

    ctx.restore();

    if (state.hovered && state.hovered.type === "regular_node" && state.hovered !== state.selected) {
      drawHoverTooltip(state.hovered);
    } else if (state.hovered && (state.hovered.type === "mega_node" || state.hovered.type === "mega_mega_node")) {
      if (state.hovered !== state.selected) {
        drawHoverTooltip(state.hovered);
      }
    }
  }

  function drawHoverTooltip(n) {
    const screenX = n.x * state.transform.k + state.transform.x;
    const screenY = n.y * state.transform.k + state.transform.y;
    const text = n.displayLabel || n.rawId;
    ctx.save();
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.font = '500 12px "Segoe UI", system-ui, sans-serif';
    const padX = 8;
    const padY = 5;
    const tw = ctx.measureText(text).width;
    const boxW = tw + padX * 2;
    const boxH = 12 + padY * 2;
    let bx = screenX + 12;
    let by = screenY - boxH - 8;
    if (bx + boxW > state.width - 8) bx = screenX - boxW - 12;
    if (by < 8) by = screenY + 14;

    ctx.fillStyle = COLORS.tooltipBg;
    ctx.strokeStyle = COLORS.tooltipBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r);
    ctx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r);
    ctx.arcTo(bx, by + boxH, bx, by, r);
    ctx.arcTo(bx, by, bx + boxW, by, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.tooltipText;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, bx + padX, by + boxH / 2);
    ctx.restore();
  }

  function findNodeAt(gx, gy) {
    let hit = null;
    let bestDist = Infinity;
    for (const n of activeNodes()) {
      if (!Number.isFinite(n.x)) continue;
      const r = nodeRadius(n);
      const dx = n.x - gx;
      const dy = n.y - gy;
      const dist = Math.hypot(dx, dy);
      const hitR = n.type === "regular_node" ? Math.max(r, 6 / state.transform.k) : r;
      if (dist <= hitR && dist < bestDist) {
        bestDist = dist;
        hit = n;
      }
    }
    return hit;
  }

  function findMegaMegaAt(gx, gy) {
    let hit = null;
    let bestDist = Infinity;
    for (const n of activeNodes()) {
      if (n.type !== "mega_mega_node" || !Number.isFinite(n.x)) continue;
      const dist = Math.hypot(n.x - gx, n.y - gy);
      if (dist <= n.radius && dist < bestDist) {
        bestDist = dist;
        hit = n;
      }
    }
    return hit;
  }

  function pointerToGraph(event) {
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    return state.transform.invert([sx, sy]);
  }

  function setupZoom() {
    zoomBehavior = d3
      .zoom()
      .scaleExtent([0.02, 12])
      .filter((event) => {
        if (state.dragging) return false;
        if (event.type === "wheel") return true;
        if (event.type === "mousedown" || event.type === "touchstart") {
          if (event.button != null && event.button !== 0) return false;
          const [gx, gy] = pointerToGraph(event);
          if (findMegaMegaAt(gx, gy)) return false;
          return true;
        }
        return true;
      })
      .on("zoom", (event) => {
        state.transform = event.transform;
        updateZoomDisplay();
        render();
      });

    d3.select(canvas).call(zoomBehavior);
  }

  function setupHoverAndClick() {
    canvas.addEventListener("mousemove", (event) => {
      if (state.dragging) return;
      const [gx, gy] = pointerToGraph(event);
      const hit = findNodeAt(gx, gy);
      if (hit !== state.hovered) {
        state.hovered = hit;
        if (hit?.type === "mega_mega_node") canvas.style.cursor = "grab";
        else canvas.style.cursor = hit ? "pointer" : "grab";
        render();
      }
    });

    canvas.addEventListener("mouseleave", () => {
      if (state.dragging) return;
      if (state.hovered) {
        state.hovered = null;
        canvas.style.cursor = "grab";
        render();
      }
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      const [gx, gy] = pointerToGraph(event);
      const megaMega = findMegaMegaAt(gx, gy);
      pointerDown = { x: event.clientX, y: event.clientY, dragged: false };

      if (megaMega) {
        event.preventDefault();
        event.stopPropagation();
        state.dragging = {
          node: megaMega,
          lastX: gx,
          lastY: gy,
        };
        pinClusterForDrag(megaMega);
        canvas.setPointerCapture?.(event.pointerId);
        canvas.style.cursor = "grabbing";
        if (state.simulation) state.simulation.alphaTarget(0).stop();
        render();
      }
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      const [gx, gy] = pointerToGraph(event);
      if (pointerDown && !pointerDown.dragged) {
        const sdx = event.clientX - pointerDown.x;
        const sdy = event.clientY - pointerDown.y;
        if (Math.hypot(sdx, sdy) <= CLICK_MOVE_PX) return;
        pointerDown.dragged = true;
        // Sync origin so the cluster doesn't jump by the click-threshold delta
        state.dragging.lastX = gx;
        state.dragging.lastY = gy;
        return;
      }
      const dx = gx - state.dragging.lastX;
      const dy = gy - state.dragging.lastY;
      if (dx === 0 && dy === 0) return;
      translateCluster(state.dragging.node, dx, dy);
      state.dragging.lastX = gx;
      state.dragging.lastY = gy;
      requestRender();
    });

    canvas.addEventListener("pointerup", (event) => {
      if (event.button !== 0) return;

      if (state.dragging) {
        const topic = state.dragging.node;
        const moved = Boolean(pointerDown?.dragged);
        state.dragging = null;
        canvas.style.cursor = "grab";

        if (moved) {
          finalizeClusterDrag(topic);
          restartSettleAfterAnchor(topic);
          requestRender();
        } else {
          // Click (not drag): drop temporary pins from pointerdown, then open panel
          const { megas } = getClusterMembers(topic);
          if (state.settled) {
            topic.fx = topic.x;
            topic.fy = topic.y;
            for (const m of megas) {
              m.fx = m.x;
              m.fy = m.y;
            }
          }
          openMegaMegaPanel(topic);
        }
        pointerDown = null;
        return;
      }

      if (!pointerDown) return;
      const dx = event.clientX - pointerDown.x;
      const dy = event.clientY - pointerDown.y;
      const moved = Math.hypot(dx, dy) > CLICK_MOVE_PX || pointerDown.dragged;
      pointerDown = null;
      if (moved) return;

      const [gx, gy] = pointerToGraph(event);
      const hit = findNodeAt(gx, gy);

      if (hit && hit.type === "regular_node") {
        openPostPanel(hit);
      } else if (hit && hit.type === "mega_node") {
        openMegaPanel(hit);
      } else if (hit && hit.type === "mega_mega_node") {
        openMegaMegaPanel(hit);
      } else {
        closePanel();
      }
    });

    panelClose.addEventListener("click", () => closePanel());
    fitViewBtn?.addEventListener("click", () => {
      fitGraphToView();
      render();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (settingsEl && !settingsEl.hidden) {
          setSettingsOpen(false);
          return;
        }
        closePanel();
      }
    });
  }

  function onResize() {
    resizeCanvas();
    if (state.settled) {
      fitGraphToView();
    }
    render();
  }

  async function init() {
    resizeCanvas();
    setupZoom();
    setupHoverAndClick();
    setupSettings();
    window.addEventListener("resize", onResize);

    try {
      const [graphRes, sentimentRes] = await Promise.all([
        fetch(DATA_FILE),
        fetch(SENTIMENT_FILE),
      ]);
      if (!graphRes.ok) throw new Error(`Failed to load graph: ${graphRes.status}`);
      const data = await graphRes.json();
      loadGraph(data);

      if (sentimentRes.ok) {
        const csvText = await sentimentRes.text();
        attachSentiment(parseCsv(csvText));
      } else {
        console.warn(`Sentiment CSV not loaded (${sentimentRes.status}); continuing without it.`);
      }

      seedPositions();
      startSimulation();
      render();
    } catch (err) {
      console.error(err);
      ctx.save();
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, state.width, state.height);
      ctx.fillStyle = COLORS.text;
      ctx.font = '500 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(
        `Could not load ${DATA_FILE} — serve this folder with a local HTTP server.`,
        state.width / 2,
        state.height / 2
      );
      ctx.restore();
    }
  }

  init();
})();
