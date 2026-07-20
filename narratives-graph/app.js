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

  // Clear, distinct family colors — one per narrative_node (parent topic)
  const FAMILY_PALETTE = [
    "#3B82F6", // blue
    "#F59E0B", // amber
    "#10B981", // emerald
    "#8B5CF6", // violet
    "#EF4444", // red
    "#06B6D4", // cyan
    "#F97316", // orange
    "#EC4899", // pink
    "#84CC16", // lime
    "#6366F1", // indigo
    "#14B8A6", // teal
    "#A855F7", // purple
    "#EAB308", // yellow
  ];

  const POST_R_DEFAULT = 3;
  const LINK_GAP = 1.5;
  const NARRATIVE_SIZE_DEFAULT = 15;
  const TOPIC_SIZE_DEFAULT = 50;
  const PARENT_LINK_GAP = 6;
  // Base pack pitch for equal-sized families; large post clouds inflate this per-parent
  const CLUSTER_PITCH = 220;
  const CLUSTER_PACK_PAD = 36;
  const FOREIGN_TOPIC_REPEL = 32;
  const FOREIGN_TOPIC_DIST_MAX = 120;
  const NARRATIVE_HUB_REPEL = 220;
  const NARRATIVE_HUB_REPEL_DIST = 280;
  const FAMILY_COLLIDE_PAD = 28;
  const TOPIC_COLLIDE_PAD = 6;
  // Initial settle should reach a readable layout quickly; local repairs stay shorter.
  const INITIAL_SIMULATION_ALPHA = 0.82;
  const INITIAL_SIMULATION_ALPHA_MIN = 0.001;
  const INITIAL_SIMULATION_ALPHA_DECAY = 0.034;
  const INITIAL_SIMULATION_VELOCITY_DECAY = 0.62;
  const LOCAL_SETTLE_ALPHA = 0.32;
  const LOCAL_SETTLE_ALPHA_DECAY = 0.035;
  const POST_LERP = 0.24;
  const POST_LERP_EPSILON = 0.04;
  // Topic/subtopic labels only after deep zoom (~4.5× fit zoom)
  const LABEL_ZOOM_MULT = 4.5;
  const TOPIC_LABEL_MAX_CHARS = 22;
  const NARRATIVE_HUB_LABEL_MAX_CHARS = 26;
  const SUBTOPIC_LABEL_MAX_CHARS = 20;
  // Screen-constant hub label size (world px = this / zoom); always drawn when hub is on-screen
  const NARRATIVE_HUB_LABEL_SCREEN_PX = 14;
  // World-space dotted grid: dots grow on screen when zoomed in
  const GRID_SPACING = 48;
  const GRID_DOT_RADIUS = 1.1;
  const GRID_DOT_ALPHA = 0.16;
  // Soft family territory discs behind each parent cluster
  const FAMILY_AURA_ALPHA = 0.11;
  const FAMILY_AURA_STROKE_ALPHA = 0.22;
  // Political axis used to order topics in the narrative panel (anti → pro default)
  const TOPIC_SORT_STANCES_ANTI_FIRST = [
    "anti_government",
    "anti_cjp",
    "pro_cjp",
    "pro_government",
  ];
  const TOPIC_SORT_STANCES_PRO_FIRST = [...TOPIC_SORT_STANCES_ANTI_FIRST].reverse();

  function activeTopicSortStances() {
    return settings.reverseStanceSort
      ? TOPIC_SORT_STANCES_PRO_FIRST
      : TOPIC_SORT_STANCES_ANTI_FIRST;
  }
  const GOLDEN_ANGLE = 2.399963229728653;
  const CLICK_MOVE_PX = 5;
  const DATA_FILE = "graph2_parent_topic_topic.json";
  const SENTIMENT_FILE = "CJP_Master_Nexus_Input_20_July.csv";
  document.title = "Narratives";
  const PANEL_MAX_W = 400;

  const SETTINGS_DEFAULTS = {
    topicSize: TOPIC_SIZE_DEFAULT,
    narrativeSize: NARRATIVE_SIZE_DEFAULT,
    postSize: POST_R_DEFAULT,
    showEmptyTopics: false,
    showEmptyPostTopics: false,
    // Default: anti first. When true, reverse to pro → anti.
    reverseStanceSort: false,
  };

  // Stance axis (anti → pro by default; toggle reverses for panels, lists, and packing)
  const STANCE_ORDER_ANTI_FIRST = [
    "anti_government",
    "anti_cjp",
    "mixed",
    "unclear",
    "neutral_news",
    "pro_cjp",
    "pro_government",
  ];
  const STANCE_ORDER_PRO_FIRST = [...STANCE_ORDER_ANTI_FIRST].reverse();
  const UNKNOWN_STANCE = "unknown";

  function buildDefaultStanceVisibility() {
    const map = Object.create(null);
    const visibleByDefault = new Set([
      "anti_government",
      "anti_cjp",
      "neutral_news",
      "pro_cjp",
      "pro_government",
    ]);
    for (const key of [...STANCE_ORDER_ANTI_FIRST, UNKNOWN_STANCE]) {
      map[key] = visibleByDefault.has(key);
    }
    return map;
  }

  function stanceVisibilityDiffersFromDefault() {
    const defaults = buildDefaultStanceVisibility();
    for (const key of Object.keys(defaults)) {
      if (Boolean(settings.stanceVisibility[key]) !== Boolean(defaults[key])) {
        return true;
      }
    }
    return false;
  }

  const settings = {
    ...SETTINGS_DEFAULTS,
    stanceVisibility: buildDefaultStanceVisibility(),
  };

  function activeStanceOrder() {
    return settings.reverseStanceSort ? STANCE_ORDER_PRO_FIRST : STANCE_ORDER_ANTI_FIRST;
  }
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
  const BLAND_GREY = "#E9ECF0";

  const canvas = document.getElementById("graph");
  const ctx = canvas.getContext("2d");
  const zoomLabel = document.getElementById("zoom-label");
  const fitViewBtn = document.getElementById("fit-view");
  const overviewToggle = document.getElementById("overview-toggle");
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
    narratives: [],
    topics: [],
    subtopics: [],
    posts: [],
    structuralNodes: [],
    structuralLinks: [],
    topicsByNarrative: new Map(),
    subtopicsByTopic: new Map(),
    postsByParent: new Map(),
    transform: d3.zoomIdentity,
    simulation: null,
    hovered: null,
    selected: null,
    highlightIds: null,
    stanceFilter: null,
    panelListQuery: "",
    panelMode: null,
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

  function subtopicSizeRange() {
    const base = settings.narrativeSize * 0.75;
    return { min: base * 0.7, max: base * 1.3 };
  }

  function narrativeHubSizeRange() {
    const base = settings.topicSize;
    return { min: base * 0.8, max: base * 1.2 };
  }

  function topicSizeRange() {
    const base = settings.narrativeSize;
    return { min: base * 0.7, max: base * 1.3 };
  }

  function nodeRadius(d) {
    if (d.type === "narrative_node" || d.type === "topic_node" || d.type === "subtopic_node") return d.radius;
    return postR();
  }

  function applyNodeRadii() {
    const pillar = narrativeHubSizeRange();
    const topic = topicSizeRange();
    const subtopic = subtopicSizeRange();
    for (const n of state.nodes) {
      if (n.type === "narrative_node") {
        n.radius = scaleRadius(n.degree, pillar.min, pillar.max, 160);
      } else if (n.type === "topic_node") {
        n.radius = scaleRadius(n.degree, topic.min, topic.max, 120);
        n.farthestPostDistance = 0;
      } else if (n.type === "subtopic_node") {
        n.radius = scaleRadius(n.degree, subtopic.min, subtopic.max, 80);
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

  // Estimate the farthest post centre from a hub (topic or subtopic).
  function estimateFarthestPostDistance(hub, postCount) {
    const count = Math.max(0, postCount ?? hub.childPostCount ?? 0);
    if (!count) return hub.radius;
    const pr = postR();
    const packR = Math.sqrt(count) * (pr + 2.1) * 0.82;
    return hub.radius + LINK_GAP + pr + packR;
  }

  function refreshClusterExtents() {
    for (const st of state.subtopics) {
      st.childPostCount = visiblePostsForParent(st).length;
      st.topicCollisionRadius = Math.max(
        st.radius,
        estimateFarthestPostDistance(st, st.childPostCount),
        st.farthestPostDistance || 0
      );
      st.cloudRadius = st.topicCollisionRadius + postR();
    }
    for (const n of state.topics) {
      const subtopics = state.subtopicsByTopic.get(n.id) || [];
      let outer = n.radius;
      for (const st of subtopics) {
        if (isExcluded(st)) continue;
        const lx = st.localX || 0;
        const ly = st.localY || 0;
        const dist = Math.hypot(lx, ly) + (st.cloudRadius || st.topicCollisionRadius || st.radius);
        outer = Math.max(outer, dist);
      }
      const directPosts = visiblePostsForParent(n);
      if (directPosts.length) {
        outer = Math.max(outer, estimateFarthestPostDistance(n, directPosts.length));
      }
      n.childPostCount = visiblePostsForTopic(n).length;
      n.topicCollisionRadius = Math.max(
        n.radius,
        outer,
        n.farthestPostDistance || 0
      );
      n.cloudRadius = n.topicCollisionRadius + postR();
    }
    for (const n of state.narratives) {
      const topics = state.topicsByNarrative.get(n.id) || [];
      let outer = n.radius;
      for (const t of topics) {
        if (isExcluded(t)) continue;
        outer = Math.max(outer, narrativeLinkDistance(n, t) + topicCollisionRadius(t));
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
      const row = byPostId.get(String(n.rawPostId));
      if (!row) {
        n.sentiment = null;
        n.stance = null;
        n.stanceIndex = activeStanceOrder().length;
        continue;
      }
      matched += 1;
      n.sentiment = row;
      n.stance = row.stance || null;
      const idx = activeStanceOrder().indexOf(n.stance);
      n.stanceIndex = idx >= 0 ? idx : activeStanceOrder().length;
    }
    console.info(`Sentiment matched ${matched} / ${byPostId.size} CSV rows to graph posts`);
  }

  function computeStanceDistribution(posts) {
    const visible = uiVisiblePosts(posts);
    const keys = visibleStanceKeys();
    const counts = Object.create(null);
    for (const key of keys) counts[key] = 0;
    for (const p of visible) {
      const key = stanceKey(p);
      if (!(key in counts)) continue;
      counts[key] += 1;
    }
    const total = visible.length;
    const entries = [];
    for (const key of keys) {
      const postCount = counts[key] || 0;
      if (!postCount) continue;
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
    return d.type === "topic_node"
      ? d.topicCollisionRadius || d.radius
      : d.radius || postR();
  }

  function narrativeLinkDistance(pillar, topic) {
    return pillar.radius + PARENT_LINK_GAP + topicCollisionRadius(topic);
  }

  // Translate a pillar hub and its topics together so family spacing stays intact.
  function nudgeFamilyVelocity(pillar, vx, vy) {
    pillar.vx = (pillar.vx || 0) + vx;
    pillar.vy = (pillar.vy || 0) + vy;
    for (const topic of state.topicsByNarrative.get(pillar.id) || []) {
      topic.vx = (topic.vx || 0) + vx;
      topic.vy = (topic.vy || 0) + vy;
    }
  }

  function translateFamily(pillar, dx, dy) {
    pillar.x += dx;
    pillar.y += dy;
    for (const topic of state.topicsByNarrative.get(pillar.id) || []) {
      topic.x += dx;
      topic.y += dy;
    }
  }

  // Narrative is the sole attractor: only topics receive spring force.
  function forceNarrativeAttract(strength = 0.95) {
    let pairs = [];
    function force(alpha) {
      const s = strength * alpha;
      for (const { pillar, topic } of pairs) {
        if (!Number.isFinite(pillar.x) || !Number.isFinite(topic.x)) continue;
        if (topic.fx != null || topic.fy != null) continue;
        let dx = topic.x - pillar.x;
        let dy = topic.y - pillar.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1e-6) {
          dx = 0.01;
          dy = 0;
          dist = 0.01;
        }
        const target = narrativeLinkDistance(pillar, topic);
        const mag = ((dist - target) / dist) * s;
        topic.vx -= dx * mag;
        topic.vy -= dy * mag;
      }
    }
    force.initialize = (nodes) => {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      pairs = [];
      for (const link of activeStructuralLinks()) {
        const s = typeof link.source === "object" ? link.source : byId.get(link.source);
        const t = typeof link.target === "object" ? link.target : byId.get(link.target);
        if (!s || !t) continue;
        if (s.type === "narrative_node" && t.type === "topic_node") {
          pairs.push({ pillar: s, topic: t });
        } else if (t.type === "narrative_node" && s.type === "topic_node") {
          pairs.push({ pillar: t, topic: s });
        }
      }
    };
    return force;
  }

  // Topics collide with each other and with foreign narrative hubs.
  function forceTopicCollide(strength = 1.2) {
    let topics = [];
    let pillars = [];
    function force(alpha) {
      const s = strength * alpha;
      for (let i = 0; i < topics.length; i += 1) {
        const a = topics[i];
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
        if (a.fx != null || a.fy != null) continue;

        for (let j = i + 1; j < topics.length; j += 1) {
          const b = topics[j];
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

        for (const pillar of pillars) {
          if (a.parentId === pillar.id) continue;
          if (!Number.isFinite(pillar.x) || !Number.isFinite(pillar.y)) continue;
          let dx = a.x - pillar.x;
          let dy = a.y - pillar.y;
          let dist = Math.hypot(dx, dy);
          const minDist = topicCollisionRadius(a) + pillar.radius + TOPIC_COLLIDE_PAD;
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
      topics = nodes.filter((n) => n.type === "topic_node");
      pillars = nodes.filter((n) => n.type === "narrative_node");
    };
    return force;
  }

  function resolveTopicCollisions(passes = 18) {
    const pillars = activeStructuralNodes().filter((n) => n.type === "narrative_node");
    const topics = activeStructuralNodes().filter((n) => n.type === "topic_node");

    for (let pass = 0; pass < passes; pass += 1) {
      let moved = false;

      for (let i = 0; i < pillars.length; i += 1) {
        const a = pillars[i];
        for (let j = i + 1; j < pillars.length; j += 1) {
          const b = pillars[j];
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

      for (let i = 0; i < topics.length; i += 1) {
        const a = topics[i];
        if (a.fx != null || a.fy != null) continue;
        for (let j = i + 1; j < topics.length; j += 1) {
          const b = topics[j];
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

        const pillar = a.parentId != null ? state.byId.get(a.parentId) : null;
        if (pillar && Number.isFinite(pillar.x)) {
          let dx = a.x - pillar.x;
          let dy = a.y - pillar.y;
          let dist = Math.hypot(dx, dy);
          const minDist = narrativeLinkDistance(pillar, a);
          if (dist < minDist) {
            if (dist < 1e-6) {
              dx = 0.01;
              dy = 0;
              dist = 0.01;
            }
            const scale = minDist / dist;
            a.x = pillar.x + dx * scale;
            a.y = pillar.y + dy * scale;
            moved = true;
          }
        }
      }

      if (!moved) break;
    }
  }

  function forceFamilyCollide(strength = 1.15) {
    let pillars = [];
    function force(alpha) {
      const s = strength * alpha;
      for (let i = 0; i < pillars.length; i += 1) {
        const a = pillars[i];
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
        for (let j = i + 1; j < pillars.length; j += 1) {
          const b = pillars[j];
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
      pillars = initNodes.filter((n) => n.type === "narrative_node");
    };
    return force;
  }

  function forceFamilyRepel(strengthMag, distanceMax) {
    let pillars = [];
    const dist2Max = distanceMax * distanceMax;
    function force(alpha) {
      const s = strengthMag * alpha;
      for (let i = 0; i < pillars.length; i += 1) {
        const a = pillars[i];
        if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) continue;
        if (a.fx != null || a.fy != null) continue;
        for (let j = i + 1; j < pillars.length; j += 1) {
          const b = pillars[j];
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
      pillars = nodes.filter((n) => n.type === "narrative_node");
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

  function linkKind(src, tgt) {
    const types = new Set([src.type, tgt.type]);
    if (types.has("narrative_node") && types.has("topic_node")) return "narrative_link";
    if (types.has("topic_node") && types.has("subtopic_node")) return "topic_link";
    if (types.has("regular_node") && (types.has("topic_node") || types.has("subtopic_node"))) {
      return "post_link";
    }
    return "other";
  }

  function displayLabelFromNode(n) {
    const label = String(n.label || "").trim();
    if (label) {
      return label
        .replace(/^Parent Topic:\s*/i, "")
        .replace(/^Pillar:\s*/i, "")
        .replace(/^Topic:\s*/i, "")
        .replace(/^Subtopic:\s*/i, "")
        .replace(/^Post:\s*/i, "")
        .replace(/^Narrative:\s*/i, "")
        .trim();
    }
    const raw = String(n.rawId || "");
    if (raw.startsWith("parent_topic_")) return raw.slice(13);
    if (raw.startsWith("pillar_")) return raw.slice(7);
    if (raw.startsWith("topic_")) return raw.slice(6);
    if (raw.startsWith("subtopic_")) return raw.slice(9);
    if (raw.startsWith("post_")) return raw.slice(5);
    return raw;
  }

  function loadGraph(data) {
    const nodes = (data.nodes || []).map((n, i) => ({
      id: i,
      rawId: n.id,
      rawPostId:
        n.type === "regular_node" && String(n.id).startsWith("post_")
          ? String(n.id).slice(5)
          : n.type === "regular_node"
            ? String(n.id)
            : null,
      type: n.type === "pillar_node" || n.type === "parent_topic_node" ? "narrative_node" : n.type,
      label: n.label || "",
      radius: POST_R_DEFAULT,
      degree: 0,
      parentId: null,
      parentIds: [],
      displayLabel: "",
      localX: 0,
      localY: 0,
    }));

    const byRawId = new Map(nodes.map((n) => [n.rawId, n]));
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const links = [];
    for (const l of data.links || []) {
      const src = byRawId.get(l.source);
      const tgt = byRawId.get(l.target);
      if (!src || !tgt || src.id === tgt.id) continue;
      links.push({
        source: src.id,
        target: tgt.id,
        kind: linkKind(src, tgt),
      });
    }

    const topicPillars = new Map();
    const subtopicTopics = new Map();
    const postParents = new Map();

    for (const l of links) {
      const src = byId.get(l.source);
      const tgt = byId.get(l.target);
      if (!src || !tgt) continue;

      if (src.type === "narrative_node" && tgt.type === "topic_node") {
        if (!topicPillars.has(tgt.id)) topicPillars.set(tgt.id, []);
        const list = topicPillars.get(tgt.id);
        if (!list.includes(src.id)) list.push(src.id);
      } else if (tgt.type === "narrative_node" && src.type === "topic_node") {
        if (!topicPillars.has(src.id)) topicPillars.set(src.id, []);
        const list = topicPillars.get(src.id);
        if (!list.includes(tgt.id)) list.push(tgt.id);
      } else if (src.type === "topic_node" && tgt.type === "subtopic_node") {
        if (!subtopicTopics.has(tgt.id)) subtopicTopics.set(tgt.id, []);
        const list = subtopicTopics.get(tgt.id);
        if (!list.includes(src.id)) list.push(src.id);
      } else if (tgt.type === "topic_node" && src.type === "subtopic_node") {
        if (!subtopicTopics.has(src.id)) subtopicTopics.set(src.id, []);
        const list = subtopicTopics.get(src.id);
        if (!list.includes(tgt.id)) list.push(tgt.id);
      } else if (
        (src.type === "topic_node" || src.type === "subtopic_node") &&
        tgt.type === "regular_node"
      ) {
        if (!postParents.has(tgt.id)) postParents.set(tgt.id, []);
        const list = postParents.get(tgt.id);
        if (!list.includes(src.id)) list.push(src.id);
      } else if (
        (tgt.type === "topic_node" || tgt.type === "subtopic_node") &&
        src.type === "regular_node"
      ) {
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
      n.displayLabel = displayLabelFromNode(n);
      if (n.type === "topic_node") {
        n.parentIds = topicPillars.get(n.id) || [];
        n.parentId = n.parentIds[0] ?? null;
      } else if (n.type === "subtopic_node") {
        n.parentIds = subtopicTopics.get(n.id) || [];
        n.parentId = n.parentIds[0] ?? null;
      } else if (n.type === "regular_node") {
        n.parentIds = postParents.get(n.id) || [];
        n.parentId = n.parentIds[0] ?? null;
      }
    }

    const pillars = nodes.filter((n) => n.type === "narrative_node").sort((a, b) => a.id - b.id);
    pillars.forEach((p, i) => {
      const fill = FAMILY_PALETTE[i % FAMILY_PALETTE.length];
      p.color = fill;
      p.strokeColor = darkenHex(fill, 0.28);
      p.linkColor = hexToRgba(fill, 0.3);
    });

    function inheritPillarColor(node) {
      let cur = node;
      while (cur) {
        if (cur.type === "narrative_node") return cur;
        cur = cur.parentId != null ? byId.get(cur.parentId) : null;
      }
      return null;
    }

    for (const n of nodes) {
      if (n.type === "topic_node" || n.type === "subtopic_node") {
        const pillar = inheritPillarColor(n);
        if (pillar?.color) {
          n.color = pillar.color;
          n.strokeColor = darkenHex(pillar.color, n.type === "subtopic_node" ? 0.15 : 0.2);
          n.linkColor = hexToRgba(pillar.color, 0.22);
        } else {
          n.color = COLORS.orphan;
          n.strokeColor = COLORS.orphanStroke;
          n.linkColor = hexToRgba(COLORS.orphan, 0.22);
        }
      } else if (n.type === "regular_node") {
        const parent = n.parentId != null ? byId.get(n.parentId) : null;
        n.color = COLORS.postFallback;
        n.familyColor = parent?.color ? lightenHex(parent.color, 0.45) : COLORS.postFallback;
      }
    }

    const topicCountByPillar = new Map();
    for (const n of nodes) {
      if (n.type !== "topic_node" || n.parentId == null) continue;
      topicCountByPillar.set(n.parentId, (topicCountByPillar.get(n.parentId) || 0) + 1);
    }
    for (const p of pillars) {
      p.hasTopics = (topicCountByPillar.get(p.id) || 0) > 0;
    }

    state.nodes = nodes;
    state.links = links;
    state.byId = byId;
    state.narratives = nodes.filter((n) => n.type === "narrative_node");
    state.topics = nodes.filter((n) => n.type === "topic_node");
    state.subtopics = nodes.filter((n) => n.type === "subtopic_node");
    state.posts = nodes.filter((n) => n.type === "regular_node");
    state.structuralNodes = [...state.narratives, ...state.topics];
    state.structuralLinks = links.filter((l) => l.kind === "narrative_link");
    state.topicsByNarrative = new Map();
    state.subtopicsByTopic = new Map();
    state.postsByParent = new Map();

    for (const topic of state.topics) {
      if (topic.parentId == null) continue;
      if (!state.topicsByNarrative.has(topic.parentId)) state.topicsByNarrative.set(topic.parentId, []);
      state.topicsByNarrative.get(topic.parentId).push(topic);
    }
    for (const st of state.subtopics) {
      if (st.parentId == null) continue;
      if (!state.subtopicsByTopic.has(st.parentId)) state.subtopicsByTopic.set(st.parentId, []);
      state.subtopicsByTopic.get(st.parentId).push(st);
    }
    for (const post of state.posts) {
      if (post.parentId == null) continue;
      if (!state.postsByParent.has(post.parentId)) state.postsByParent.set(post.parentId, []);
      state.postsByParent.get(post.parentId).push(post);
    }
    applyNodeRadii();
  }

  function isExcluded(n) {
    if (!n) return true;
    if (n.type === "narrative_node") {
      return !n.hasTopics && !settings.showEmptyTopics;
    }
    if (n.type === "topic_node") {
      if (!settings.showEmptyPostTopics && getAllPostsForTopic(n).length === 0) {
        return true;
      }
      if (n.parentId != null) {
        const parent = state.byId.get(n.parentId);
        if (parent && isExcluded(parent)) return true;
      }
      return false;
    }
    if (n.type === "subtopic_node") {
      if (n.parentId != null) {
        const parent = state.byId.get(n.parentId);
        if (parent && isExcluded(parent)) return true;
      }
      return false;
    }
    if (n.type === "regular_node") {
      if (!isPostStanceVisible(n)) return true;
      if (n.parentId != null) {
        const parent = state.byId.get(n.parentId);
        if (parent && isExcluded(parent)) return true;
      }
      return false;
    }
    return false;
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
    const pillars = state.narratives.filter((n) => !isExcluded(n));
    const topics = state.topics;
    const posts = state.posts;
    const pillarById = new Map(pillars.map((n) => [n.id, n]));
    const parentById = new Map([...pillars, ...topics, ...state.subtopics].map((n) => [n.id, n]));

    refreshClusterExtents();
    pillars.sort(
      (a, b) => (b.clusterExtent || 0) - (a.clusterExtent || 0) || (b.degree || 0) - (a.degree || 0)
    );
    const placed = [];
    pillars.forEach((p, i) => {
      const extent = Math.max(p.clusterExtent || CLUSTER_PITCH * 0.4, CLUSTER_PITCH * 0.35);
      if (i === 0) {
        p.x = cx;
        p.y = cy;
      } else {
        let bestX = cx;
        let bestY = cy;
        let found = false;
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

    for (const n of state.nodes) {
      if (n.type === "narrative_node" && isExcluded(n)) {
        n.x = cx;
        n.y = cy;
        n.vx = 0;
        n.vy = 0;
        n.fx = null;
        n.fy = null;
      }
    }

    const orphanTopics = [];
    for (const t of topics) {
      if (isExcluded(t)) continue;
      if (t.parentId != null && pillarById.has(t.parentId)) continue;
      orphanTopics.push(t);
    }

    for (const [pillarId, group] of state.topicsByNarrative) {
      const pillar = pillarById.get(pillarId);
      if (!pillar) continue;
      const visibleGroup = group.filter((t) => !isExcluded(t));
      visibleGroup.sort((a, b) => (b.childPostCount || b.degree || 0) - (a.childPostCount || a.degree || 0));
      let angleCursor = -Math.PI / 2;
      visibleGroup.forEach((t) => {
        const angle = visibleGroup.length === 1 ? -Math.PI / 2 : angleCursor;
        const dist = narrativeLinkDistance(pillar, t);
        t.x = pillar.x + Math.cos(angle) * dist;
        t.y = pillar.y + Math.sin(angle) * dist;
        t.vx = 0;
        t.vy = 0;
        t.fx = null;
        t.fy = null;
        const circumferenceShare = Math.max(0.35, (t.cloudRadius || t.radius) / Math.max(1, pillar.clusterExtent));
        angleCursor += Math.max(GOLDEN_ANGLE * 0.55, circumferenceShare * Math.PI);
      });
    }

    orphanTopics.sort((a, b) => (b.childPostCount || b.degree || 0) - (a.childPostCount || a.degree || 0));
    orphanTopics.forEach((t, i) => {
      const extent = t.cloudRadius || 80;
      const r = extent + 24 * Math.sqrt(i + 0.5);
      const angle = i * GOLDEN_ANGLE;
      t.x = cx + Math.cos(angle) * r;
      t.y = cy + Math.sin(angle) * r;
      t.vx = 0;
      t.vy = 0;
      t.fx = null;
      t.fy = null;
    });

    for (const topic of topics) {
      if (isExcluded(topic) || !Number.isFinite(topic.x)) continue;
      const subtopics = (state.subtopicsByTopic.get(topic.id) || []).filter((st) => !isExcluded(st));
      if (subtopics.length) placeSubtopicsAroundTopic(topic, subtopics, { immediate: true });
    }

    for (const post of posts) {
      const parent = post.parentId != null ? parentById.get(post.parentId) : null;
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

    for (const [parentId, group] of state.postsByParent) {
      const parent = parentById.get(parentId);
      if (parent) placePostsByStance(parent, group, { immediate: true });
    }
    refreshClusterExtents();
    syncWorldPositions();
  }

  function subtopicExtent(st) {
    const postCount = visiblePostsForParent(st).length;
    return Math.max(st.radius, estimateFarthestPostDistance(st, postCount));
  }

  function placeSubtopicsAroundTopic(topic, subtopics, { immediate = false } = {}) {
    if (!subtopics.length) return;
    subtopics.sort(
      (a, b) =>
        (state.postsByParent.get(b.id)?.length || 0) - (state.postsByParent.get(a.id)?.length || 0)
    );
    const spacing =
      Math.max(...subtopics.map((st) => st.radius)) * 2 +
      postR() * 2 +
      6;
    const innerRadius = topic.radius + PARENT_LINK_GAP + Math.max(...subtopics.map((st) => st.radius));
    const rowPitch = spacing * Math.sqrt(3) / 2;
    let outerRadius = innerRadius + spacing;
    let slots = [];

    while (slots.length < subtopics.length) {
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
      if (slots.length < subtopics.length) outerRadius += spacing;
    }

    slots.sort((a, b) => a.dist - b.dist);
    slots = slots.slice(0, subtopics.length);
    slots.sort((a, b) => {
      const aa = (Math.atan2(a.y, a.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      const ba = (Math.atan2(b.y, b.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
      return aa - ba || a.dist - b.dist;
    });

    let farthest = topic.radius;
    subtopics.forEach((st, i) => {
      const slot = slots[i];
      st.targetLocalX = slot.x;
      st.targetLocalY = slot.y;
      if (immediate || !Number.isFinite(st.localX) || !Number.isFinite(st.localY)) {
        st.localX = st.targetLocalX;
        st.localY = st.targetLocalY;
      }
      st.x = topic.x + st.localX;
      st.y = topic.y + st.localY;
      st.vx = 0;
      st.vy = 0;
      farthest = Math.max(farthest, slot.dist + subtopicExtent(st));
    });
    topic.farthestSubtopicDistance = farthest;
  }

  // Pack posts around a hub in angular wedges by stance so same-stance posts sit together.
  function placePostsByStance(parent, group, { immediate = false } = {}) {
    const visibleGroup = group.filter(isPostStanceVisible);
    if (!visibleGroup.length) {
      if (parent.type === "subtopic_node") {
        parent.farthestPostDistance = parent.radius;
        parent.topicCollisionRadius = parent.radius;
        parent.cloudRadius = parent.radius + postR();
      } else if (parent.type === "topic_node") {
        parent.farthestPostDistance = parent.radius;
      }
      return;
    }
    const buckets = new Map();
    for (const post of visibleGroup) {
      const key = stanceKey(post);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(post);
    }
    const order = [...activeStanceOrder(), UNKNOWN_STANCE].filter((k) => buckets.has(k));
    const spacing = postR() * 2 + 2.5;
    const innerRadius = parent.radius + LINK_GAP + postR();
    const rowPitch = spacing * Math.sqrt(3) / 2;
    let outerRadius = innerRadius + spacing;
    let slots = [];

    // Generate a collision-free hex lattice, growing only until every post has a slot.
    while (slots.length < visibleGroup.length) {
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
      if (slots.length < visibleGroup.length) outerRadius += spacing;
    }

    // Keep the most compact N slots, then order by angle. Assigning stance buckets
    // consecutively creates wedges without sacrificing lattice separation.
    slots.sort((a, b) => a.dist - b.dist);
    slots = slots.slice(0, visibleGroup.length);
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
    if (parent.type === "subtopic_node") {
      parent.farthestPostDistance =
        slots.length ? Math.max(...slots.map((slot) => slot.dist)) : parent.radius;
      parent.topicCollisionRadius = parent.farthestPostDistance;
      parent.cloudRadius = parent.farthestPostDistance + postR();
    } else if (parent.type === "topic_node") {
      parent.farthestPostDistance = Math.max(
        parent.farthestPostDistance || parent.radius,
        slots.length ? Math.max(...slots.map((slot) => slot.dist)) : parent.radius
      );
    }
  }

  function layoutAllLocalPacks({ immediate = false } = {}) {
    for (const topic of state.topics) {
      if (isExcluded(topic) || !Number.isFinite(topic.x)) continue;
      const subtopics = (state.subtopicsByTopic.get(topic.id) || []).filter((st) => !isExcluded(st));
      if (subtopics.length) {
        placeSubtopicsAroundTopic(topic, subtopics, { immediate });
      }
    }
    for (const [parentId, posts] of state.postsByParent) {
      const parent = state.byId.get(parentId);
      if (!parent || isExcluded(parent)) continue;
      placePostsByStance(parent, posts, { immediate });
    }
    refreshClusterExtents();
    syncWorldPositions();
    if (state.postsAnimating) requestRender();
  }

  function syncWorldPositions(advance = false) {
    let animating = false;

    for (const topic of state.topics) {
      if (!Number.isFinite(topic.x) || !Number.isFinite(topic.y)) continue;
      const subtopics = state.subtopicsByTopic.get(topic.id) || [];
      for (const st of subtopics) {
        st.x = topic.x + (st.localX || 0);
        st.y = topic.y + (st.localY || 0);
      }
    }

    for (const [parentId, posts] of state.postsByParent) {
      const parent = state.byId.get(parentId);
      if (!parent || !Number.isFinite(parent.x) || !Number.isFinite(parent.y)) continue;
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
        post.x = parent.x + (post.localX || 0);
        post.y = parent.y + (post.localY || 0);
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
      .force("pillarAttract", forceNarrativeAttract())
      .force(
        "repelFamilies",
        forceFamilyRepel(NARRATIVE_HUB_REPEL, NARRATIVE_HUB_REPEL_DIST)
      )
      .force(
        "repelForeignTopics",
        forceForeignClusterRepel({
          type: "topic_node",
          parentKey: "parentId",
          strength: FOREIGN_TOPIC_REPEL,
          distanceMax: FOREIGN_TOPIC_DIST_MAX,
        })
      )
      .force("familyCollision", forceFamilyCollide())
      .force("topicCollision", forceTopicCollide())
      .on("tick", onTick)
      .on("end", onSimEnd);
  }

  function onTick() {
    syncWorldPositions();
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
    syncWorldPositions();
    state.settled = true;
    if (!state.dragging && !state.skipFitOnSimEnd) fitGraphToView();
    state.skipFitOnSimEnd = false;
    requestRender();
  }

  function requestRender() {
    if (state.renderFrame != null) return;
    state.renderFrame = requestAnimationFrame(() => {
      state.renderFrame = null;
      const keepAnimating = syncWorldPositions(true);
      render();
      if (keepAnimating) requestRender();
    });
  }

  function getClusterMembers(pillar) {
    const topics = state.topicsByNarrative.get(pillar.id) || [];
    const subtopics = [];
    const posts = [];
    for (const topic of topics) {
      subtopics.push(...(state.subtopicsByTopic.get(topic.id) || []));
      posts.push(...getAllPostsForTopic(topic));
    }
    return { pillar, topics, subtopics, posts, all: [pillar, ...topics, ...subtopics, ...posts] };
  }

  function translateCluster(pillar, dx, dy) {
    const { topics } = getClusterMembers(pillar);
    for (const n of [pillar, ...topics]) {
      n.x += dx;
      n.y += dy;
      if (n.fx != null) n.fx += dx;
      if (n.fy != null) n.fy += dy;
      n.vx = 0;
      n.vy = 0;
    }
    syncWorldPositions();
  }

  function pinClusterForDrag(pillar) {
    const { topics } = getClusterMembers(pillar);
    for (const n of [pillar, ...topics]) {
      n.fx = n.x;
      n.fy = n.y;
      n.vx = 0;
      n.vy = 0;
    }
  }

  function finalizeClusterDrag(pillar) {
    const { topics } = getClusterMembers(pillar);
    pillar.userPinned = true;
    pillar.fx = pillar.x;
    pillar.fy = pillar.y;
    for (const t of topics) {
      t.fx = t.x;
      t.fy = t.y;
      t.vx = 0;
      t.vy = 0;
    }
  }

  function overlappingParentIds(draggedParent) {
    const ids = new Set([draggedParent.id]);
    const draggedR = draggedParent.clusterExtent || draggedParent.radius;
    for (const other of state.narratives) {
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
        for (const topic of state.topicsByNarrative.get(parentId) || []) {
          topic.fx = null;
          topic.fy = null;
        }
      }
    }

    if (affectedParentIds.size === 1) {
      for (const topic of state.topicsByNarrative.get(draggedParent.id) || []) {
        topic.fx = topic.x;
        topic.fy = topic.y;
      }
      state.settleParentIds = null;
      state.settled = true;
      state.skipFitOnSimEnd = false;
      requestRender();
      return;
    }

    const nodes = activeStructuralNodes();
    state.simulation.nodes(nodes);
    state.simulation.force("pillarAttract")?.initialize?.(nodes);
    state.simulation.force("topicCollision")?.initialize?.(nodes);
    state.simulation.force("familyCollision")?.initialize?.(nodes);
    state.simulation.force("repelFamilies")?.initialize?.(nodes);
    state.simulation.force("repelForeignTopics")?.initialize?.(nodes);
    state.simulation.alpha(LOCAL_SETTLE_ALPHA).alphaDecay(LOCAL_SETTLE_ALPHA_DECAY).restart();
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

  function getPostsForParent(parent) {
    return state.postsByParent.get(parent.id) || [];
  }

  function isStanceVisible(stance) {
    const key = stance && STANCE_COLORS[stance] ? stance : UNKNOWN_STANCE;
    return settings.stanceVisibility[key] !== false;
  }

  function isPostStanceVisible(post) {
    return isStanceVisible(stanceKey(post));
  }

  function visibleStanceKeys() {
    return [...activeStanceOrder(), UNKNOWN_STANCE].filter(isStanceVisible);
  }

  function uiVisiblePosts(posts) {
    return (posts || []).filter(isPostStanceVisible);
  }

  function ensureValidStanceFilter() {
    if (state.stanceFilter && !isStanceVisible(state.stanceFilter)) {
      state.stanceFilter = null;
    }
  }

  function visiblePostsForParent(parent) {
    return getPostsForParent(parent).filter(isPostStanceVisible);
  }

  function visiblePostsForTopic(topic) {
    const posts = [...visiblePostsForParent(topic)];
    for (const st of getSubtopicsForTopic(topic)) {
      posts.push(...visiblePostsForParent(st));
    }
    return posts;
  }

  function getTopicsForPillar(pillar) {
    return state.topicsByNarrative.get(pillar.id) || [];
  }

  function getSubtopicsForTopic(topic) {
    return state.subtopicsByTopic.get(topic.id) || [];
  }

  function getAllPostsForTopic(topic) {
    const posts = [...(state.postsByParent.get(topic.id) || [])];
    for (const st of getSubtopicsForTopic(topic)) {
      posts.push(...getPostsForParent(st));
    }
    return posts;
  }

  function getAllPostsForPillar(pillar) {
    const posts = [];
    for (const topic of getTopicsForPillar(pillar)) {
      posts.push(...getAllPostsForTopic(topic));
    }
    return posts;
  }

  function topicSortMeta(topic) {
    const posts = uiVisiblePosts(getAllPostsForTopic(topic));
    const sortStances = activeTopicSortStances().filter(isStanceVisible);
    const counts = Object.create(null);
    for (const s of sortStances) counts[s] = 0;
    for (const p of posts) {
      const k = stanceKey(p);
      if (k in counts) counts[k] += 1;
    }
    let dominant = null;
    let dominantCount = 0;
    for (const s of sortStances) {
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
      orderIdx: dominant != null ? sortStances.indexOf(dominant) : sortStances.length,
    };
  }

  function sortTopicsByPoliticalStance(topics) {
    return topics.slice().sort((a, b) => {
      const ma = topicSortMeta(a);
      const mb = topicSortMeta(b);
      if (ma.orderIdx !== mb.orderIdx) return ma.orderIdx - mb.orderIdx;
      if (mb.dominantCount !== ma.dominantCount) return mb.dominantCount - ma.dominantCount;
      const da = mb.posts.length - ma.posts.length;
      if (da) return da;
      return String(a.displayLabel || a.rawId).localeCompare(String(b.displayLabel || b.rawId), undefined, { numeric: true });
    });
  }

  function postsMatchingStance(posts, stance) {
    const visible = uiVisiblePosts(posts);
    if (!stance) return visible;
    if (!isStanceVisible(stance)) return [];
    return visible.filter((p) => stanceKey(p) === stance);
  }

  function applyStanceFilterHighlights(anchor, posts, children) {
    ensureValidStanceFilter();
    const filteredPosts = postsMatchingStance(posts, state.stanceFilter);
    const ids = new Set([anchor.id, ...filteredPosts.map((p) => p.id)]);
    if (children) {
      for (const child of children) {
        const childPosts =
          child.type === "topic_node"
            ? uiVisiblePosts(getAllPostsForTopic(child))
            : uiVisiblePosts(getPostsForParent(child));
        const matching = postsMatchingStance(childPosts, state.stanceFilter);
        if (!state.stanceFilter || matching.length) ids.add(child.id);
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
    layoutAllLocalPacks({ immediate: visibilityChanged });
    if (state.simulation) {
      if (visibilityChanged) {
        seedPositions();
        startSimulation();
        state.settled = false;
        state.skipFitOnSimEnd = false;
      } else {
        const nodes = activeStructuralNodes();
        for (const n of nodes) {
          if (n.type === "narrative_node" && n.userPinned) continue;
          n.fx = null;
          n.fy = null;
        }
        state.simulation.force("pillarAttract")?.initialize?.(nodes);
        state.simulation.force("topicCollision")?.initialize?.(nodes);
        state.simulation.force("familyCollision")?.initialize?.(nodes);
        state.simulation.force("repelFamilies")?.initialize?.(nodes);
        state.simulation.force("repelForeignTopics")?.initialize?.(nodes);
        state.settled = false;
        state.simulation.alpha(0.22).alphaDecay(0.065).restart();
      }
    }
    requestRender();
  }

  function syncSettingControls(key) {
    if (
      key === "showEmptyTopics" ||
      key === "showEmptyPostTopics" ||
      key === "reverseStanceSort"
    ) {
      const box = document.getElementById(`set-${key}`);
      if (box) box.checked = Boolean(settings[key]);
      return;
    }
    if (key === "stanceVisibility") {
      syncStanceVisibilityControls();
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

  function syncStanceVisibilityControls() {
    const root = document.getElementById("stance-visibility");
    if (!root) return;
    for (const key of [...activeStanceOrder(), UNKNOWN_STANCE]) {
      const box = root.querySelector(`input[data-stance="${key}"]`);
      if (box) box.checked = isStanceVisible(key);
    }
  }

  function syncAllSettingControls() {
    for (const key of [
      "topicSize",
      "narrativeSize",
      "postSize",
      "showEmptyTopics",
      "showEmptyPostTopics",
      "reverseStanceSort",
      "stanceVisibility",
    ]) {
      syncSettingControls(key);
    }
  }

  function reindexPostStances() {
    const order = activeStanceOrder();
    for (const n of state.posts) {
      if (!n.stance) {
        n.stanceIndex = order.length;
        continue;
      }
      const idx = order.indexOf(n.stance);
      n.stanceIndex = idx >= 0 ? idx : order.length;
    }
  }

  function refreshOpenPanelForStanceSort() {
    const sel = state.selected;
    if (state.panelMode === "overview") {
      openOverviewPanel({ keepFilter: true });
      return;
    }
    if (!sel) return;
    if (sel.type === "narrative_node") openNarrativePanel(sel, { keepFilter: true });
    else if (sel.type === "topic_node") openTopicPanel(sel, { keepFilter: true });
    else if (sel.type === "subtopic_node") openSubtopicPanel(sel, { keepFilter: true });
  }

  function setSettingFromUi(key, rawValue) {
    if (key === "showEmptyTopics" || key === "showEmptyPostTopics") {
      settings[key] = Boolean(rawValue);
      syncSettingControls(key);
      applySettingsLive({ visibilityChanged: true });
      if (state.panelMode === "overview") openOverviewPanel({ keepFilter: true });
      return;
    }
    if (key === "reverseStanceSort") {
      settings.reverseStanceSort = Boolean(rawValue);
      syncSettingControls(key);
      reindexPostStances();
      layoutAllLocalPacks({ immediate: true });
      refreshOpenPanelForStanceSort();
      requestRender();
      return;
    }
    if (key === "stanceVisibility") {
      const { stance, visible } = rawValue || {};
      if (!stance) return;
      settings.stanceVisibility[stance] = Boolean(visible);
      ensureValidStanceFilter();
      syncStanceVisibilityControls();
      applySettingsLive({ visibilityChanged: false });
      layoutAllLocalPacks({ immediate: true });
      if (state.panelMode === "overview") openOverviewPanel({ keepFilter: true });
      else refreshOpenPanelForStanceSort();
      requestRender();
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
    buildStanceVisibilityControls();
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

    const emptyPostTopicsToggle = document.getElementById("set-showEmptyPostTopics");
    emptyPostTopicsToggle?.addEventListener("change", () => {
      setSettingFromUi("showEmptyPostTopics", emptyPostTopicsToggle.checked);
    });

    const reverseToggle = document.getElementById("set-reverseStanceSort");
    reverseToggle?.addEventListener("change", () => {
      setSettingFromUi("reverseStanceSort", reverseToggle.checked);
    });

    settingsToggle?.addEventListener("click", () => {
      setSettingsOpen(!!settingsEl.hidden);
    });
    settingsClose?.addEventListener("click", () => setSettingsOpen(false));
    settingsReset?.addEventListener("click", () => {
      const visibilityChanged =
        settings.showEmptyTopics !== SETTINGS_DEFAULTS.showEmptyTopics ||
        settings.showEmptyPostTopics !== SETTINGS_DEFAULTS.showEmptyPostTopics ||
        stanceVisibilityDiffersFromDefault();
      const stanceSortChanged =
        settings.reverseStanceSort !== SETTINGS_DEFAULTS.reverseStanceSort;
      Object.assign(settings, SETTINGS_DEFAULTS);
      settings.stanceVisibility = buildDefaultStanceVisibility();
      syncAllSettingControls();
      applySettingsLive({ visibilityChanged });
      if (stanceSortChanged) {
        reindexPostStances();
        layoutAllLocalPacks({ immediate: true });
        refreshOpenPanelForStanceSort();
      }
      if (state.panelMode === "overview") openOverviewPanel({ keepFilter: true });
    });
  }

  function buildStanceVisibilityControls() {
    const root = document.getElementById("stance-visibility");
    if (!root) return;
    root.replaceChildren();
    for (const key of [...STANCE_ORDER_ANTI_FIRST, UNKNOWN_STANCE]) {
      const label = document.createElement("label");
      label.className = "setting-check stance-visibility-row";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.stance = key;
      input.checked = isStanceVisible(key);
      input.addEventListener("change", () => {
        setSettingFromUi("stanceVisibility", {
          stance: key,
          visible: input.checked,
        });
      });
      const swatch = document.createElement("span");
      swatch.className = "stance-swatch";
      swatch.style.background = stanceColor(key);
      const text = document.createElement("span");
      text.textContent =
        key === UNKNOWN_STANCE ? "No sentiment" : STANCE_LABELS[key] || key;
      label.appendChild(input);
      label.appendChild(swatch);
      label.appendChild(text);
      root.appendChild(label);
    }
  }

  function showPanelShell(title) {
    panelTitle.textContent = title;
    document.body.classList.add("panel-open");
    panelEl.hidden = false;
    panelEl.setAttribute("aria-hidden", "false");
    overviewToggle?.setAttribute(
      "aria-expanded",
      state.panelMode === "overview" ? "true" : "false"
    );
    overviewToggle?.classList.toggle("is-active", state.panelMode === "overview");
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
      if (typeof onFilterChange === "function") row.classList.add("is-clickable");
      if (state.stanceFilter === e.stance) row.classList.add("is-active");
      else if (state.stanceFilter) row.classList.add("is-dimmed");
      row.title = state.stanceFilter === e.stance
        ? "Click to clear filter"
        : `Click to filter: ${e.label}`;
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
        if (typeof onFilterChange !== "function") return;
        state.stanceFilter = state.stanceFilter === e.stance ? null : e.stance;
        onFilterChange(state.stanceFilter);
      });

      legend.appendChild(row);
    }
    wrap.appendChild(legend);

    appendField(parent, "Sentiment distribution", wrap);
  }

  function debounce(fn, ms) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function cleanNodeMetaLabel(label, displayLabel) {
    if (!label) return null;
    const cleaned = String(label)
      .replace(/^Parent Topic:\s*/i, "")
      .replace(/^Pillar:\s*/i, "")
      .replace(/^Topic:\s*/i, "")
      .replace(/^Subtopic:\s*/i, "")
      .replace(/^Post:\s*/i, "")
      .replace(/^Narrative:\s*/i, "")
      .trim();
    if (!cleaned || cleaned === displayLabel) return null;
    return cleaned;
  }

  function updateReverseSortButton(btn) {
    if (!btn) return;
    const reversed = Boolean(settings.reverseStanceSort);
    btn.setAttribute("aria-pressed", reversed ? "true" : "false");
    btn.setAttribute("aria-label", reversed ? "Sentiment order reversed" : "Reverse sentiment order");
    btn.title = reversed
      ? "Order reversed — click to restore default"
      : "Reverse sentiment sort order";
  }

  function toggleReverseStanceSort({ refreshPanel = true } = {}) {
    settings.reverseStanceSort = !settings.reverseStanceSort;
    syncSettingControls("reverseStanceSort");
    reindexPostStances();
    layoutAllLocalPacks({ immediate: true });
    if (refreshPanel) refreshOpenPanelForStanceSort();
    requestRender();
  }

  function appendListChrome(field, {
    labelText,
    searchPlaceholder,
    emptyText,
    getItems,
    matchItem,
    renderItem,
  }) {
    const header = document.createElement("div");
    header.className = "panel-list-header";

    const lab = document.createElement("div");
    lab.className = "panel-label";
    lab.textContent = labelText;
    header.appendChild(lab);

    const reverseBtn = document.createElement("button");
    reverseBtn.type = "button";
    reverseBtn.className = "panel-sort-toggle";
    reverseBtn.innerHTML =
      '<svg class="panel-sort-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
      '<path d="M4.5 2v9.2L2.7 9.4l-.7.7L5 13.1l3-2.9-.7-.7-1.8 1.7V2h-1zM11 2.9l-3 2.9.7.7 1.8-1.7V14h1V4.8l1.8 1.7.7-.7L11 2.9z"/>' +
      "</svg>" +
      '<span class="panel-sort-label">Reverse</span>';
    updateReverseSortButton(reverseBtn);
    reverseBtn.addEventListener("click", () => {
      toggleReverseStanceSort({ refreshPanel: true });
    });
    header.appendChild(reverseBtn);
    field.appendChild(header);

    const search = document.createElement("input");
    search.type = "search";
    search.className = "panel-search";
    search.placeholder = searchPlaceholder;
    search.value = state.panelListQuery || "";
    search.setAttribute("aria-label", searchPlaceholder);
    field.appendChild(search);

    const listWrap = document.createElement("div");
    listWrap.className = "panel-list-body panel-narratives panel-posts";
    field.appendChild(listWrap);

    function refill() {
      const items = getItems();
      const q = String(state.panelListQuery || "").trim().toLowerCase();
      const filtered = q ? items.filter((item) => matchItem(item, q)) : items;
      const base = labelText.replace(/\s*\(\d+(?:\s+of\s+\d+)?(?:\s+filtered)?\)\s*$/, "").trim();
      lab.textContent = q
        ? `${base} (${filtered.length} of ${items.length})`
        : labelText;

      listWrap.replaceChildren();
      if (!filtered.length) {
        listWrap.appendChild(makeValue(emptyText || "No matches."));
        return;
      }
      for (const item of filtered) renderItem(listWrap, item);
    }

    const onSearch = debounce(() => {
      state.panelListQuery = search.value;
      refill();
    }, 220);
    search.addEventListener("input", onSearch);

    refill();
    return { refill, search, reverseBtn };
  }

  function appendPostsList(parentEl, posts) {
    const postsField = document.createElement("div");
    postsField.className = "panel-field";

    const baseLabel = state.stanceFilter
      ? `Posts (${posts.length} filtered)`
      : `Posts (${posts.length})`;

    appendListChrome(postsField, {
      labelText: baseLabel,
      searchPlaceholder: "Search posts…",
      emptyText: state.stanceFilter ? "No posts for this sentiment." : "No linked posts.",
      getItems: () =>
        posts.slice().sort((a, b) => {
          const sa = a.stanceIndex ?? 999;
          const sb = b.stanceIndex ?? 999;
          if (sa !== sb) return sa - sb;
          return String(a.rawPostId || a.rawId).localeCompare(String(b.rawPostId || b.rawId), undefined, {
            numeric: true,
          });
        }),
      matchItem: (p, q) => {
        const hay = [
          p.rawPostId,
          p.rawId,
          p.displayLabel,
          p.stance,
          p.sentiment?.content_snippet,
          p.sentiment?.post_narrative,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      },
      renderItem: (wrap, p) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "post-card post-card-btn";
        card.style.borderLeftColor = stanceColor(stanceKey(p));
        card.addEventListener("click", () => openPostPanel(p));

        const top = document.createElement("div");
        top.className = "post-card-top";
        top.appendChild(makeStanceBadge(p.stance));
        card.appendChild(top);

        const idEl = document.createElement("div");
        idEl.className = "post-card-id";
        idEl.textContent = p.rawPostId || p.rawId;
        card.appendChild(idEl);

        const title = document.createElement("div");
        title.className = "post-card-title";
        const snippet = p.sentiment?.content_snippet;
        title.textContent = snippet
          ? truncateLabel(snippet, 110)
          : (p.displayLabel || p.rawPostId || p.rawId);
        card.appendChild(title);

        wrap.appendChild(card);
      },
    });

    parentEl.appendChild(postsField);
  }

  function openPostPanel(post) {
    state.stanceFilter = null;
    state.panelListQuery = "";
    state.panelMode = "detail";
    state.selected = post;
    state.highlightIds = new Set([post.id]);
    showPanelShell("Post");
    panelBody.replaceChildren();

    appendPanelHero(panelBody, post.rawPostId || post.displayLabel || post.rawId);

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

    const parentWrap = document.createElement("div");
    parentWrap.className = "panel-narratives";
    const parentIds = post.parentIds || (post.parentId != null ? [post.parentId] : []);
    if (parentIds.length === 0) {
      parentWrap.appendChild(makeValue("No linked parent."));
    } else {
      for (const parentId of parentIds) {
        const parent = state.byId.get(parentId);
        let hint = null;
        let onClick = null;
        if (parent?.type === "subtopic_node") {
          hint = "Open subtopic →";
          onClick = () => openSubtopicPanel(parent);
        } else if (parent?.type === "topic_node") {
          hint = "Open topic →";
          onClick = () => openTopicPanel(parent);
        }
        const pillar = parent?.parentId != null ? state.byId.get(parent.parentId) : null;
        const pillarLabel =
          pillar?.type === "narrative_node"
            ? pillar.displayLabel
            : parent?.type === "subtopic_node" && parent.parentId != null
              ? state.byId.get(parent.parentId)?.displayLabel
              : null;
        parentWrap.appendChild(
          makeNavCard({
            title: parent ? parent.displayLabel || parent.rawId : String(parentId),
            meta: pillarLabel ? `Narrative: ${pillarLabel}` : cleanNodeMetaLabel(parent?.label, parent?.displayLabel),
            hint,
            color: parent?.color || null,
            onClick: parent ? onClick : null,
          })
        );
      }
    }
    appendField(panelBody, "Parent", parentWrap);
    render();
  }

  function openSubtopicPanel(subtopic, { keepFilter = false } = {}) {
    if (!keepFilter) {
      state.stanceFilter = null;
      state.panelListQuery = "";
    }
    ensureValidStanceFilter();
    state.panelMode = "detail";
    const allPosts = uiVisiblePosts(getPostsForParent(subtopic));
    state.selected = subtopic;
    applyStanceFilterHighlights(subtopic, allPosts, null);
    showPanelShell("Subtopic");
    panelBody.replaceChildren();

    appendPanelHero(panelBody, subtopic.displayLabel || subtopic.rawId || "—");

    const topicWrap = document.createElement("div");
    topicWrap.className = "panel-narratives";
    const topic = subtopic.parentId != null ? state.byId.get(subtopic.parentId) : null;
    if (!topic) {
      topicWrap.appendChild(makeValue("No parent topic."));
    } else {
      topicWrap.appendChild(
        makeNavCard({
          title: topic.displayLabel || topic.rawId,
          meta: cleanNodeMetaLabel(topic.label, topic.displayLabel),
          hint: "Open topic →",
          color: topic.color || subtopic.color || null,
          onClick: () => openTopicPanel(topic),
        })
      );
    }
    appendField(panelBody, "Topic", topicWrap);

    appendStanceDistribution(panelBody, allPosts, {
      onFilterChange: () => openSubtopicPanel(subtopic, { keepFilter: true }),
    });

    appendPostsList(panelBody, postsMatchingStance(allPosts, state.stanceFilter));
    render();
    if (!keepFilter) focusNodes([subtopic, ...postsMatchingStance(allPosts, state.stanceFilter)]);
  }

  function openTopicPanel(topic, { keepFilter = false } = {}) {
    if (!keepFilter) {
      state.stanceFilter = null;
      state.panelListQuery = "";
    }
    ensureValidStanceFilter();
    state.panelMode = "detail";
    const subtopics = getSubtopicsForTopic(topic);
    const allPosts = uiVisiblePosts(getAllPostsForTopic(topic));
    state.selected = topic;
    const filteredPosts = applyStanceFilterHighlights(topic, allPosts, [...subtopics]);
    showPanelShell("Topic");
    panelBody.replaceChildren();

    appendPanelHero(
      panelBody,
      topic.displayLabel || topic.rawId || "—",
      cleanNodeMetaLabel(topic.label, topic.displayLabel)
    );

    const pillarWrap = document.createElement("div");
    pillarWrap.className = "panel-narratives";
    const pillar = topic.parentId != null ? state.byId.get(topic.parentId) : null;
    if (!pillar) {
      pillarWrap.appendChild(makeValue("No parent narrative."));
    } else {
      pillarWrap.appendChild(
        makeNavCard({
          title: pillar.displayLabel || pillar.rawId,
          hint: "Open narrative →",
          color: pillar.color || topic.color || null,
          onClick: () => openNarrativePanel(pillar),
        })
      );
    }
    appendField(panelBody, "Narrative", pillarWrap);

    appendStanceDistribution(panelBody, allPosts, {
      onFilterChange: () => openTopicPanel(topic, { keepFilter: true }),
    });

    if (subtopics.length) {
      const visibleSubtopics = subtopics.filter((st) => {
        const stPosts = uiVisiblePosts(getPostsForParent(st));
        if (!stPosts.length) return false;
        if (!state.stanceFilter) return true;
        return postsMatchingStance(stPosts, state.stanceFilter).length > 0;
      });
      const subsField = document.createElement("div");
      subsField.className = "panel-field";
      const subsLab = document.createElement("div");
      subsLab.className = "panel-label";
      subsLab.textContent = state.stanceFilter
        ? `Subtopics (${visibleSubtopics.length} of ${subtopics.length})`
        : `Subtopics (${subtopics.length})`;
      subsField.appendChild(subsLab);

      const subsWrap = document.createElement("div");
      subsWrap.className = "panel-narratives";
      if (!visibleSubtopics.length) {
        subsWrap.appendChild(makeValue(state.stanceFilter ? "No subtopics for this sentiment." : "No subtopics."));
      } else {
        for (const st of visibleSubtopics) {
          const stPosts = uiVisiblePosts(getPostsForParent(st));
          const matching = postsMatchingStance(stPosts, state.stanceFilter);
          subsWrap.appendChild(
            makeNavCard({
              title: st.displayLabel || st.rawId,
              meta: `${matching.length} post${matching.length === 1 ? "" : "s"}`,
              hint: "Open subtopic →",
              color: st.color || topic.color || null,
              onClick: () => openSubtopicPanel(st),
            })
          );
        }
      }
      subsField.appendChild(subsWrap);
      panelBody.appendChild(subsField);
    }

    const directPosts = postsMatchingStance(
      uiVisiblePosts(state.postsByParent.get(topic.id) || []),
      state.stanceFilter
    );
    // Flat graph: all posts hang on the topic. Also show when mixed with subtopics.
    if (directPosts.length || !subtopics.length) {
      appendPostsList(panelBody, directPosts.length ? directPosts : filteredPosts);
    }

    render();
    if (!keepFilter) focusNodes([topic, ...subtopics, ...filteredPosts]);
  }

  function openNarrativePanel(pillar, { keepFilter = false } = {}) {
    if (!keepFilter) {
      state.stanceFilter = null;
      state.panelListQuery = "";
    }
    ensureValidStanceFilter();
    state.panelMode = "detail";
    const topics = getTopicsForPillar(pillar);
    const allPosts = uiVisiblePosts(getAllPostsForPillar(pillar));
    state.selected = pillar;
    const filteredPosts = applyStanceFilterHighlights(pillar, allPosts, topics);
    showPanelShell("Narrative");
    panelBody.replaceChildren();

    appendPanelHero(panelBody, pillar.displayLabel || pillar.rawId || "—");

    appendStanceDistribution(panelBody, allPosts, {
      onFilterChange: () => openNarrativePanel(pillar, { keepFilter: true }),
    });

    const topicsField = document.createElement("div");
    topicsField.className = "panel-field";

    const topicsWithVisiblePosts = (t) =>
      postsMatchingStance(getAllPostsForTopic(t), state.stanceFilter).length > 0;

    const baseLabel = state.stanceFilter
      ? `Topics (${topics.filter(topicsWithVisiblePosts).length} of ${topics.length})`
      : `Topics (${topics.length})`;

    appendListChrome(topicsField, {
      labelText: baseLabel,
      searchPlaceholder: "Search topics…",
      emptyText: state.stanceFilter ? "No topics for this sentiment." : "No linked topics.",
      getItems: () =>
        sortTopicsByPoliticalStance(topics).filter((t) => {
          if (!state.stanceFilter) return true;
          return topicsWithVisiblePosts(t);
        }),
      matchItem: (t, q) => {
        const meta = topicSortMeta(t);
        const hay = [
          t.displayLabel,
          t.rawId,
          t.label,
          meta.dominant,
          meta.dominant ? STANCE_LABELS[meta.dominant] : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      },
      renderItem: (wrap, t) => {
        const meta = topicSortMeta(t);
        const matching = postsMatchingStance(meta.posts, state.stanceFilter);
        const postCount = matching.length;
        const stanceHint = meta.dominant
          ? `${STANCE_LABELS[meta.dominant] || meta.dominant} · ${meta.dominantCount}`
          : "No political sentiment";
        wrap.appendChild(
          makeNavCard({
            title: t.displayLabel || t.rawId,
            meta: `${postCount} post${postCount === 1 ? "" : "s"} · ${stanceHint}`,
            hint: "Open topic →",
            color: meta.dominant ? stanceColor(meta.dominant) : (t.color || pillar.color || null),
            onClick: () => openTopicPanel(t),
          })
        );
      },
    });

    panelBody.appendChild(topicsField);

    render();
    if (!keepFilter) {
      const visibleTopics = sortTopicsByPoliticalStance(topics).filter((t) => {
        if (!state.stanceFilter) return true;
        return topicsWithVisiblePosts(t);
      });
      focusNodes([pillar, ...visibleTopics, ...filteredPosts]);
    }
  }

  function closePanel() {
    if (!state.selected && state.panelMode == null && panelEl.hidden) return;
    state.selected = null;
    state.highlightIds = null;
    state.stanceFilter = null;
    state.panelMode = null;
    state.panelListQuery = "";
    document.body.classList.remove("panel-open");
    panelEl.hidden = true;
    panelEl.setAttribute("aria-hidden", "true");
    panelBody.replaceChildren();
    overviewToggle?.setAttribute("aria-expanded", "false");
    overviewToggle?.classList.remove("is-active");
    render();
  }

  function applyOverviewStanceHighlights(posts) {
    ensureValidStanceFilter();
    if (!state.stanceFilter) {
      state.highlightIds = null;
      return postsMatchingStance(posts, null);
    }
    const matching = postsMatchingStance(posts, state.stanceFilter);
    const ids = new Set(matching.map((p) => p.id));
    for (const post of matching) {
      let cur = post.parentId != null ? state.byId.get(post.parentId) : null;
      while (cur) {
        ids.add(cur.id);
        cur = cur.parentId != null ? state.byId.get(cur.parentId) : null;
      }
    }
    state.highlightIds = ids;
    return matching;
  }

  function openOverviewPanel({ keepFilter = false } = {}) {
    if (!keepFilter) {
      state.stanceFilter = null;
      state.panelListQuery = "";
    }
    ensureValidStanceFilter();
    state.selected = null;
    state.panelMode = "overview";
    showPanelShell("Overview");
    panelBody.replaceChildren();

    const narratives = state.narratives
      .slice()
      .sort((a, b) => {
        const pa = uiVisiblePosts(getAllPostsForPillar(a)).length;
        const pb = uiVisiblePosts(getAllPostsForPillar(b)).length;
        if (pb !== pa) return pb - pa;
        return String(a.displayLabel || a.rawId).localeCompare(
          String(b.displayLabel || b.rawId),
          undefined,
          { numeric: true }
        );
      });

    const allPosts = uiVisiblePosts(state.posts);
    applyOverviewStanceHighlights(allPosts);
    const topicCount = state.topics.length;
    const emptyTopicCount = state.topics.filter(
      (t) => getAllPostsForTopic(t).length === 0
    ).length;
    const emptyNarrativeCount = state.narratives.filter((n) => !n.hasTopics).length;

    appendPanelHero(
      panelBody,
      "All narratives",
      `${narratives.length} narratives · ${topicCount} topics · ${allPosts.length} posts`
    );

    const stats = document.createElement("div");
    stats.className = "overview-stats";
    const statItems = [
      { label: "Narratives", value: String(narratives.length) },
      { label: "Topics", value: String(topicCount) },
      { label: "Posts", value: String(allPosts.length) },
      {
        label: "Empty topics",
        value: String(emptyTopicCount),
      },
      {
        label: "Empty narratives",
        value: String(emptyNarrativeCount),
      },
    ];
    for (const item of statItems) {
      const cell = document.createElement("div");
      cell.className = "overview-stat";
      const val = document.createElement("div");
      val.className = "overview-stat-value";
      val.textContent = item.value;
      const lab = document.createElement("div");
      lab.className = "overview-stat-label";
      lab.textContent = item.label;
      cell.appendChild(val);
      cell.appendChild(lab);
      stats.appendChild(cell);
    }
    appendField(panelBody, "Corpus", stats);

    appendStanceDistribution(panelBody, allPosts, {
      onFilterChange: () => openOverviewPanel({ keepFilter: true }),
    });

    const visibleNarratives = state.stanceFilter
      ? narratives.filter(
          (pillar) =>
            postsMatchingStance(getAllPostsForPillar(pillar), state.stanceFilter).length > 0
        )
      : narratives;

    const listField = document.createElement("div");
    listField.className = "panel-field";
    const listLab = document.createElement("div");
    listLab.className = "panel-label";
    listLab.textContent = state.stanceFilter
      ? `Narratives (${visibleNarratives.length} of ${narratives.length})`
      : `Narratives (${narratives.length})`;
    listField.appendChild(listLab);

    const list = document.createElement("div");
    list.className = "panel-narratives overview-narrative-list";

    if (!visibleNarratives.length) {
      list.appendChild(
        makeValue(
          state.stanceFilter ? "No narratives for this sentiment." : "No narratives loaded."
        )
      );
    } else {
      for (const pillar of visibleNarratives) {
        const topics = getTopicsForPillar(pillar);
        const posts = uiVisiblePosts(getAllPostsForPillar(pillar));
        const matchingPosts = postsMatchingStance(posts, state.stanceFilter);
        const { entries } = computeStanceDistribution(posts);
        const emptyTopics = topics.filter((t) => getAllPostsForTopic(t).length === 0).length;
        const card = document.createElement("button");
        card.type = "button";
        card.className = "narrative-card narrative-card-btn overview-narrative-card";
        if (pillar.color) {
          card.style.borderLeftColor = pillar.color;
          card.style.borderLeftWidth = "4px";
        }

        const title = document.createElement("div");
        title.className = "narrative-card-title";
        title.textContent = pillar.displayLabel || pillar.rawId || "—";
        card.appendChild(title);

        const meta = document.createElement("div");
        meta.className = "narrative-card-meta";
        const bits = [
          `${topics.length} topic${topics.length === 1 ? "" : "s"}`,
          state.stanceFilter
            ? `${matchingPosts.length} of ${posts.length} post${posts.length === 1 ? "" : "s"}`
            : `${posts.length} post${posts.length === 1 ? "" : "s"}`,
        ];
        if (emptyTopics) {
          bits.push(`${emptyTopics} empty`);
        }
        meta.textContent = bits.join(" · ");
        card.appendChild(meta);

        if (posts.length) {
          const bar = document.createElement("div");
          bar.className = "stance-bar overview-stance-bar";
          bar.setAttribute("role", "img");
          bar.setAttribute(
            "aria-label",
            entries
              .filter((e) => e.post_count)
              .map((e) => `${e.label} ${e.percentage}%`)
              .join(", ")
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
          card.appendChild(bar);

          const topStances = entries
            .filter((e) => e.post_count)
            .slice(0, 3)
            .map((e) => `${e.label} ${e.post_count}`);
          if (topStances.length) {
            const stanceMeta = document.createElement("div");
            stanceMeta.className = "narrative-card-meta overview-stance-meta";
            stanceMeta.textContent = topStances.join(" · ");
            card.appendChild(stanceMeta);
          }
        } else {
          const empty = document.createElement("div");
          empty.className = "narrative-card-meta";
          empty.textContent = pillar.hasTopics
            ? "Topics present, no posts linked."
            : "No topics.";
          card.appendChild(empty);
        }

        const hint = document.createElement("div");
        hint.className = "narrative-card-hint";
        hint.textContent = "Open narrative →";
        card.appendChild(hint);

        card.addEventListener("click", () => openNarrativePanel(pillar));
        list.appendChild(card);
      }
    }

    listField.appendChild(list);
    panelBody.appendChild(listField);
    render();
  }

  function isHighlighted(n) {
    return state.highlightIds != null && state.highlightIds.has(n.id);
  }

  function hubFocusActive() {
    if (
      state.panelMode === "overview" &&
      state.highlightIds != null &&
      state.highlightIds.size > 0
    ) {
      return true;
    }
    const t = state.selected?.type;
    return (
      (t === "topic_node" || t === "narrative_node" || t === "subtopic_node") &&
      state.highlightIds != null &&
      state.highlightIds.size > 0
    );
  }

  function stancePostHighlightActive() {
    if (state.panelMode === "overview" && state.stanceFilter) return true;
    if (state.stanceFilter && hubFocusActive()) return true;
    if (!hubFocusActive() && state.selected?.type !== "regular_node") return false;
    return (
      state.selected?.type === "topic_node" ||
      state.selected?.type === "subtopic_node" ||
      state.selected?.type === "regular_node"
    );
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
    const focusing = hubFocusActive();
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

    // Dotted world-space grid — denser/smaller on screen when zoomed out, larger when zoomed in
    {
      let spacing = GRID_SPACING;
      const viewW = view.right - view.left;
      const viewH = view.bottom - view.top;
      const maxDots = 6000;
      const est = (viewW / spacing) * (viewH / spacing);
      if (est > maxDots) {
        spacing = Math.ceil(Math.sqrt((viewW * viewH) / maxDots) / GRID_SPACING) * GRID_SPACING;
      }
      const x0 = Math.floor(view.left / spacing) * spacing;
      const x1 = Math.ceil(view.right / spacing) * spacing;
      const y0 = Math.floor(view.top / spacing) * spacing;
      const y1 = Math.ceil(view.bottom / spacing) * spacing;
      const dotR = GRID_DOT_RADIUS;
      ctx.fillStyle = hexToRgba("#64748B", GRID_DOT_ALPHA);
      ctx.beginPath();
      for (let x = x0; x <= x1; x += spacing) {
        for (let y = y0; y <= y1; y += spacing) {
          ctx.moveTo(x + dotR, y);
          ctx.arc(x, y, dotR, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    }

    // Soft family territory discs (bg highlight for each parent topic cluster)
    for (const n of state.narratives) {
      if (isExcluded(n) || !Number.isFinite(n.x)) continue;
      const auraR = n.clusterExtent || n.radius * 8;
      if (!visible(n, auraR)) continue;
      const dimmed = focusing && !isHighlighted(n) && state.selected !== n;
      const base = n.color || COLORS.orphan;
      const alpha = dimmed ? FAMILY_AURA_ALPHA * COLORS.dimAlpha : FAMILY_AURA_ALPHA;
      ctx.beginPath();
      ctx.arc(n.x, n.y, auraR, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(base, alpha);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(
        base,
        dimmed ? FAMILY_AURA_STROKE_ALPHA * COLORS.dimAlpha : FAMILY_AURA_STROKE_ALPHA
      );
      ctx.lineWidth = 1.25 / t.k;
      ctx.stroke();
    }

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
        if (l.kind === "narrative_link") continue;
        const s = linkEndpoint(l.source);
        const tg = linkEndpoint(l.target);
        if (!s || !tg || !Number.isFinite(s.x) || !Number.isFinite(tg.x)) continue;
        if (isExcluded(s) || isExcluded(tg)) continue;
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
        (state.panelMode === "overview" ||
          state.selected?.type === "topic_node" ||
          state.selected?.type === "subtopic_node" ||
          state.selected === n ||
          (state.stanceFilter &&
            (state.selected?.type === "narrative_node" ||
              state.selected?.type === "topic_node")));
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
    const hubLabelSize = NARRATIVE_HUB_LABEL_SCREEN_PX / t.k;
    const placedLabels = [];
    const placedHubLabels = [];

    function labelFits(sx, sy, w, h, bucket = placedLabels) {
      const pad = 4;
      const left = sx - w / 2 - pad;
      const right = sx + w / 2 + pad;
      const top = sy - h / 2 - pad;
      const bottom = sy + h / 2 + pad;
      for (const box of bucket) {
        if (left < box.right && right > box.left && top < box.bottom && bottom > box.top) {
          return false;
        }
      }
      bucket.push({ left, right, top, bottom });
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

    // Always-on parent hub labels — constant screen size, halo for contrast
    function drawNarrativeHubLabel(n, text) {
      if (!Number.isFinite(n.x)) return;
      const label = truncateLabel(text, NARRATIVE_HUB_LABEL_MAX_CHARS);
      const size = hubLabelSize;
      ctx.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`;
      const metrics = ctx.measureText(label);
      const w = metrics.width;
      const h = size;
      const offsets = [
        [0, -(n.radius + h * 0.95)],
        [0, n.radius + h * 0.95],
        [0, 0],
      ];
      for (const [ox, oy] of offsets) {
        const wx = n.x + ox;
        const wy = n.y + oy;
        const sx = wx * t.k + t.x;
        const sy = wy * t.k + t.y;
        // Hub labels only collide with other hubs so they stay readable at any zoom
        if (!labelFits(sx, sy, w * t.k, h * t.k, placedHubLabels)) continue;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Soft pill behind text for readability over dense posts
        const padX = 5 / t.k;
        const padY = 3 / t.k;
        const rx = 4 / t.k;
        ctx.beginPath();
        const left = wx - w / 2 - padX;
        const top = wy - h / 2 - padY;
        const pw = w + padX * 2;
        const ph = h + padY * 2;
        ctx.moveTo(left + rx, top);
        ctx.arcTo(left + pw, top, left + pw, top + ph, rx);
        ctx.arcTo(left + pw, top + ph, left, top + ph, rx);
        ctx.arcTo(left, top + ph, left, top, rx);
        ctx.arcTo(left, top, left + pw, top, rx);
        ctx.closePath();
        ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 0.75 / t.k;
        ctx.stroke();
        ctx.fillStyle = COLORS.text;
        ctx.fillText(label, wx, wy);
        return;
      }
    }

    // Subtopics — hex-packed around topics, inherit pillar family color
    for (const n of state.subtopics) {
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
      const strokeW = (selected ? 3 : hovered ? 2.25 : 1.15) / t.k;
      drawNodeCircle(n, fill, stroke, strokeW);
      if (selected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 3.5 / t.k, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.selectionRing;
        ctx.lineWidth = 1.25 / t.k;
        ctx.setLineDash([3 / t.k, 2.5 / t.k]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (!dimmed) {
        drawNodeLabel(n, n.displayLabel, SUBTOPIC_LABEL_MAX_CHARS, "600", fontSize * 0.92);
      }
    }

    // Topics — inherit family color from pillar
    for (const n of state.topics) {
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
        drawNodeLabel(n, n.displayLabel, TOPIC_LABEL_MAX_CHARS, "600", fontSize);
      }
    }

    // Narratives (draw on top)
    for (const n of state.narratives) {
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
    }

    // Parent hub titles last so they stay readable over topics at every zoom
    for (const n of state.narratives) {
      if (isExcluded(n) || !Number.isFinite(n.x)) continue;
      if (!visible(n, n.radius)) continue;
      const dimmed = focusing && !isHighlighted(n) && state.selected !== n;
      if (!dimmed) {
        drawNarrativeHubLabel(n, n.displayLabel);
      }
    }

    // Anchor indicator on user-pinned narratives
    for (const n of state.narratives) {
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
    } else if (
      state.hovered &&
      (state.hovered.type === "topic_node" ||
        state.hovered.type === "narrative_node" ||
        state.hovered.type === "subtopic_node")
    ) {
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

  function findPillarAt(gx, gy) {
    let hit = null;
    let bestDist = Infinity;
    for (const n of activeNodes()) {
      if (n.type !== "narrative_node" || !Number.isFinite(n.x)) continue;
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
          if (findPillarAt(gx, gy)) return false;
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
        if (hit?.type === "narrative_node") canvas.style.cursor = "grab";
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
      const pillar = findPillarAt(gx, gy);
      pointerDown = { x: event.clientX, y: event.clientY, dragged: false };

      if (pillar) {
        event.preventDefault();
        event.stopPropagation();
        state.dragging = {
          node: pillar,
          lastX: gx,
          lastY: gy,
        };
        pinClusterForDrag(pillar);
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
        const pillar = state.dragging.node;
        const moved = Boolean(pointerDown?.dragged);
        state.dragging = null;
        canvas.style.cursor = "grab";

        if (moved) {
          finalizeClusterDrag(pillar);
          restartSettleAfterAnchor(pillar);
          requestRender();
        } else {
          const { topics } = getClusterMembers(pillar);
          if (state.settled) {
            pillar.fx = pillar.x;
            pillar.fy = pillar.y;
            for (const t of topics) {
              t.fx = t.x;
              t.fy = t.y;
            }
          }
          openNarrativePanel(pillar);
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
      } else if (hit && hit.type === "subtopic_node") {
        openSubtopicPanel(hit);
      } else if (hit && hit.type === "topic_node") {
        openTopicPanel(hit);
      } else if (hit && hit.type === "narrative_node") {
        openNarrativePanel(hit);
      } else {
        closePanel();
      }
    });

    panelClose.addEventListener("click", () => closePanel());
    fitViewBtn?.addEventListener("click", () => {
      fitGraphToView();
      render();
    });
    overviewToggle?.addEventListener("click", () => {
      if (state.panelMode === "overview" && !panelEl.hidden) {
        closePanel();
        return;
      }
      openOverviewPanel();
      if (state.settled) fitGraphToView();
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
