(() => {
  const COLORS = {
    bg: "#f8fafc",
    postFallback: "#4b5563",
    postSelected: "#64748b",
    megaSelectedStroke: "#0f172a",
    text: "#000000",
    hoverStroke: "#334155",
    tooltipBg: "rgba(255, 255, 255, 0.96)",
    tooltipText: "#000000",
    tooltipBorder: "rgba(15, 23, 42, 0.18)",
    orphan: "#94a3b8",
    orphanStroke: "#64748b",
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

  const POST_R = 3;
  const LINK_GAP = 1.5;
  const MEGA_R_MIN = 12;
  const MEGA_R_MAX = 22;
  const MEGA_MEGA_R_MIN = 28;
  const MEGA_MEGA_R_MAX = 42;
  const PARENT_LINK_GAP = 6;
  const CLUSTER_PITCH = 280;
  const FOREIGN_POST_REPEL = 22;
  const FOREIGN_POST_DIST_MAX = 48;
  const FOREIGN_MEGA_REPEL = 55;
  const FOREIGN_MEGA_DIST_MAX = 160;
  const MEGA_MEGA_REPEL = 520;
  const MEGA_MEGA_REPEL_DIST = 420;
  const LABEL_ZOOM_MULT = 1.75;
  const MEGA_LABEL_MAX_CHARS = 20;
  const MEGA_MEGA_LABEL_MAX_CHARS = 24;
  // World-space font size for parent-topic labels (scales on screen with zoom)
  const MEGA_MEGA_LABEL_SIZE = 11;
  const GOLDEN_ANGLE = 2.399963229728653;
  const CLICK_MOVE_PX = 5;
  const DATA_FILE = "graph_output_topic_parent_topic.json";
  const SENTIMENT_FILE = "CJP-SEARCH-RESULTS - l1-iteration-1-sentiment.csv";
  const PANEL_MAX_W = 400;

  // Stance palette (pro → anti). Borders use these when a narrative is selected.
  const STANCE_ORDER = [
    "pro_government",
    "pro_cjp",
    "neutral_news",
    "unclear",
    "anti_cjp",
    "anti_government",
  ];
  const STANCE_COLORS = {
    pro_government: "#22c55e",
    pro_cjp: "#a3e635",
    neutral_news: "#9ca3af",
    unclear: "#9ca3af",
    anti_cjp: "#fb923c",
    anti_government: "#ef4444",
  };
  const STANCE_LABELS = {
    pro_government: "Pro government",
    pro_cjp: "Pro CJP",
    neutral_news: "Neutral / news",
    unclear: "Unclear",
    anti_cjp: "Anti CJP",
    anti_government: "Anti government",
  };
  const STANCE_FORCE = 0.55;
  const UNKNOWN_STANCE = "unknown";
  const BLAND_GREY = "#9ca3af";

  const canvas = document.getElementById("graph");
  const ctx = canvas.getContext("2d");
  const zoomLabel = document.getElementById("zoom-label");
  const fitViewBtn = document.getElementById("fit-view");
  const panelEl = document.getElementById("panel");
  const panelClose = document.getElementById("panel-close");
  const panelTitle = document.getElementById("panel-title");
  const panelBody = document.getElementById("panel-body");

  const state = {
    nodes: [],
    links: [],
    byId: new Map(),
    transform: d3.zoomIdentity,
    simulation: null,
    hovered: null,
    selected: null,
    highlightIds: null,
    dragging: null,
    baselineZoom: 1,
    width: 0,
    height: 0,
    dpr: 1,
    settled: false,
    sentimentById: null,
  };

  let zoomBehavior = null;
  let pointerDown = null;

  function nodeRadius(d) {
    if (d.type === "mega_mega_node" || d.type === "mega_node") return d.radius;
    return POST_R;
  }

  function scaleRadius(degree, minR, maxR, maxDeg = 140) {
    const t = Math.sqrt(Math.max(degree, 1));
    const maxT = Math.sqrt(maxDeg);
    const n = Math.min(1, Math.max(0, (t - 1) / (maxT - 1)));
    return minR + n * (maxR - minR);
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
        label: key === UNKNOWN_STANCE ? "No data" : (STANCE_LABELS[key] || key),
      });
    }
    return { total, entries };
  }

  function clusterCollideRadius(d) {
    if (d.type === "mega_mega_node") {
      // Keep parent topics well separated; own megas sit inside this halo
      return d.radius + PARENT_LINK_GAP + MEGA_R_MAX + 20;
    }
    if (d.type === "mega_node") {
      return d.radius + LINK_GAP + POST_R + 3;
    }
    return POST_R + 0.5;
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
      radius: POST_R,
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
        n.radius = scaleRadius(n.degree, MEGA_MEGA_R_MIN, MEGA_MEGA_R_MAX, 160);
        n.displayLabel = n.rawId;
        n.narrative = n.rawId;
      } else if (n.type === "mega_node") {
        n.radius = scaleRadius(n.degree, MEGA_R_MIN, MEGA_R_MAX, 120);
        n.displayLabel = n.rawId;
        n.narrative = n.rawId;
        n.parentIds = megaParents.get(n.id) || [];
        n.parentId = n.parentIds[0] ?? null;
      } else {
        n.radius = POST_R;
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

    state.nodes = nodes;
    state.links = links;
    state.byId = byId;
  }

  function seedPositions() {
    const cx = state.width / 2;
    const cy = state.height / 2;
    const parents = state.nodes.filter((n) => n.type === "mega_mega_node");
    const megas = state.nodes.filter((n) => n.type === "mega_node");
    const posts = state.nodes.filter((n) => n.type === "regular_node");
    const parentById = new Map(parents.map((n) => [n.id, n]));
    const megaById = new Map(megas.map((n) => [n.id, n]));

    parents.sort((a, b) => (b.degree || 0) - (a.degree || 0));
    const parentScale = CLUSTER_PITCH / Math.sqrt(Math.PI);
    parents.forEach((p, i) => {
      const r = parentScale * Math.sqrt(i + 0.5);
      const angle = i * GOLDEN_ANGLE;
      p.x = cx + Math.cos(angle) * r;
      p.y = cy + Math.sin(angle) * r;
      p.vx = 0;
      p.vy = 0;
    });

    // Group megas by parent topic; orphan megas get a shared fallback pack
    const megasByParent = new Map();
    const orphanMegas = [];
    for (const m of megas) {
      if (m.parentId != null && parentById.has(m.parentId)) {
        if (!megasByParent.has(m.parentId)) megasByParent.set(m.parentId, []);
        megasByParent.get(m.parentId).push(m);
      } else {
        orphanMegas.push(m);
      }
    }

    for (const [parentId, group] of megasByParent) {
      const parent = parentById.get(parentId);
      group.sort((a, b) => (b.degree || 0) - (a.degree || 0));
      group.forEach((m, i) => {
        const angle = (i * GOLDEN_ANGLE) % (Math.PI * 2);
        // Keep same-family megas hugged close to their parent topic
        const dist = parent.radius + PARENT_LINK_GAP + m.radius * 0.2;
        m.x = parent.x + Math.cos(angle) * dist;
        m.y = parent.y + Math.sin(angle) * dist;
        m.vx = 0;
        m.vy = 0;
      });
    }

    orphanMegas.sort((a, b) => (b.degree || 0) - (a.degree || 0));
    orphanMegas.forEach((m, i) => {
      const r = 80 + 18 * Math.sqrt(i + 0.5);
      const angle = i * GOLDEN_ANGLE;
      m.x = cx + Math.cos(angle) * r;
      m.y = cy + Math.sin(angle) * r;
      m.vx = 0;
      m.vy = 0;
    });

    const postsByParent = new Map();
    for (const post of posts) {
      const parent = post.parentId != null ? megaById.get(post.parentId) : null;
      if (!parent || !Number.isFinite(parent.x)) {
        post.x = cx + (Math.random() - 0.5) * 40;
        post.y = cy + (Math.random() - 0.5) * 40;
        post.vx = 0;
        post.vy = 0;
        continue;
      }
      if (!postsByParent.has(post.parentId)) postsByParent.set(post.parentId, []);
      postsByParent.get(post.parentId).push(post);
    }

    for (const [parentId, group] of postsByParent) {
      const parent = megaById.get(parentId);
      placePostsByStance(parent, group);
    }
  }

  // Pack posts around a mega in angular wedges by stance so same-stance posts sit together.
  function placePostsByStance(parent, group) {
    const buckets = new Map();
    for (const post of group) {
      const key = stanceKey(post);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(post);
    }
    const order = [...STANCE_ORDER, UNKNOWN_STANCE].filter((k) => buckets.has(k));
    const total = group.length || 1;
    let angleCursor = -Math.PI / 2;
    for (const key of order) {
      const bucket = buckets.get(key);
      const wedge = (bucket.length / total) * Math.PI * 2;
      bucket.forEach((post, i) => {
        const t = bucket.length === 1 ? 0.5 : (i + 0.5) / bucket.length;
        const angle = angleCursor + t * wedge;
        const ring = Math.floor(i / Math.max(6, Math.ceil(Math.sqrt(bucket.length))));
        const dist = parent.radius + LINK_GAP + POST_R + ring * (POST_R * 1.85);
        post.x = parent.x + Math.cos(angle) * dist;
        post.y = parent.y + Math.sin(angle) * dist;
        post.vx = 0;
        post.vy = 0;
      });
      angleCursor += wedge;
    }
  }

  function forceStanceSectors(strength) {
    let nodes = [];

    function force(alpha) {
      const byParent = new Map();
      for (const n of nodes) {
        if (n.type !== "regular_node" || n.parentId == null) continue;
        if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
        if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
        byParent.get(n.parentId).push(n);
      }
      const s = strength * alpha;
      for (const [parentId, group] of byParent) {
        const parent = state.byId.get(parentId);
        if (!parent || !Number.isFinite(parent.x)) continue;

        const buckets = new Map();
        for (const post of group) {
          const key = stanceKey(post);
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key).push(post);
        }
        const order = [...STANCE_ORDER, UNKNOWN_STANCE].filter((k) => buckets.has(k));
        const total = group.length || 1;
        let angleCursor = -Math.PI / 2;
        for (const key of order) {
          const bucket = buckets.get(key);
          const wedge = (bucket.length / total) * Math.PI * 2;
          bucket.forEach((post, i) => {
            const t = bucket.length === 1 ? 0.5 : (i + 0.5) / bucket.length;
            const angle = angleCursor + t * wedge;
            const ring = Math.floor(i / Math.max(6, Math.ceil(Math.sqrt(bucket.length))));
            const dist = parent.radius + LINK_GAP + POST_R + ring * (POST_R * 1.85);
            const tx = parent.x + Math.cos(angle) * dist;
            const ty = parent.y + Math.sin(angle) * dist;
            post.vx += (tx - post.x) * s;
            post.vy += (ty - post.y) * s;
          });
          angleCursor += wedge;
        }
      }
    }

    force.initialize = (initNodes) => {
      nodes = initNodes;
    };
    return force;
  }

  function linkDistance(l) {
    const s = typeof l.source === "object" ? l.source : state.byId.get(l.source);
    const t = typeof l.target === "object" ? l.target : state.byId.get(l.target);
    if (!s || !t) return 40;

    const types = new Set([s.type, t.type]);
    if (types.has("mega_mega_node") && types.has("mega_node")) {
      const parent = s.type === "mega_mega_node" ? s : t;
      const mega = s.type === "mega_node" ? s : t;
      return parent.radius + PARENT_LINK_GAP + mega.radius * 0.2;
    }
    if (types.has("mega_node") && types.has("regular_node")) {
      const mega = s.type === "mega_node" ? s : t;
      return mega.radius + POST_R + LINK_GAP;
    }
    return 48;
  }

  function linkStrength(l) {
    if (l.kind === "parent_link") return 0.9;
    return 1;
  }

  function startSimulation() {
    if (state.simulation) state.simulation.stop();

    state.simulation = d3
      .forceSimulation(state.nodes)
      .alpha(0.9)
      .alphaMin(0.001)
      .alphaDecay(0.05)
      .velocityDecay(0.5)
      .force(
        "link",
        d3
          .forceLink(state.links)
          .id((d) => d.id)
          .distance(linkDistance)
          .strength(linkStrength)
      )
      .force(
        "repelMegaMega",
        typeRepel(MEGA_MEGA_REPEL, MEGA_MEGA_REPEL_DIST, (d) => d.type === "mega_mega_node")
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
      .force(
        "repelForeignPosts",
        forceForeignClusterRepel({
          type: "regular_node",
          parentKey: "parentId",
          strength: FOREIGN_POST_REPEL,
          distanceMax: FOREIGN_POST_DIST_MAX,
        })
      )
      .force("stanceSectors", forceStanceSectors(STANCE_FORCE))
      .force(
        "collision",
        d3
          .forceCollide()
          .radius(clusterCollideRadius)
          .strength(0.9)
          .iterations(2)
      )
      .on("tick", onTick)
      .on("end", onSimEnd);
  }

  function onTick() {
    if (state.dragging || state.simulation.alpha() > 0.02 || state.hovered || state.selected) {
      render();
    }
  }

  function onSimEnd() {
    for (const n of state.nodes) {
      if (n.type === "mega_mega_node" || n.type === "mega_node") {
        // Keep manually anchored parent topics where the user left them
        if (n.type === "mega_mega_node" && n.userPinned) {
          n.fx = n.x;
          n.fy = n.y;
          continue;
        }
        n.fx = n.x;
        n.fy = n.y;
      }
    }
    state.settled = true;
    if (!state.dragging) fitGraphToView();
    render();
  }

  function getClusterMembers(megaMega) {
    const megas = [];
    const megaIds = new Set();
    for (const n of state.nodes) {
      if (n.type === "mega_node" && n.parentId === megaMega.id) {
        megas.push(n);
        megaIds.add(n.id);
      }
    }
    const posts = [];
    for (const n of state.nodes) {
      if (n.type === "regular_node" && megaIds.has(n.parentId)) posts.push(n);
    }
    return { parent: megaMega, megas, posts, all: [megaMega, ...megas, ...posts] };
  }

  function translateCluster(megaMega, dx, dy) {
    const { all } = getClusterMembers(megaMega);
    for (const n of all) {
      n.x += dx;
      n.y += dy;
      if (n.fx != null) n.fx += dx;
      if (n.fy != null) n.fy += dy;
      n.vx = 0;
      n.vy = 0;
    }
  }

  function pinClusterForDrag(megaMega) {
    const { all } = getClusterMembers(megaMega);
    for (const n of all) {
      n.fx = n.x;
      n.fy = n.y;
      n.vx = 0;
      n.vy = 0;
    }
  }

  function finalizeClusterDrag(megaMega) {
    const { parent, megas, posts } = getClusterMembers(megaMega);
    parent.userPinned = true;
    parent.fx = parent.x;
    parent.fy = parent.y;
    // Child megas stay pinned relative to the move; posts free if still settling
    for (const m of megas) {
      m.fx = m.x;
      m.fy = m.y;
    }
    if (!state.settled) {
      for (const p of posts) {
        p.fx = null;
        p.fy = null;
      }
    } else {
      for (const p of posts) {
        p.fx = null;
        p.fy = null;
      }
    }
  }

  function fitGraphToView() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of state.nodes) {
      const r = nodeRadius(n);
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      minX = Math.min(minX, n.x - r);
      minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r);
      maxY = Math.max(maxY, n.y + r);
    }
    if (!Number.isFinite(minX)) return;

    const panelBleed = panelBleedWidth();
    const pad = 56;
    const usableW = Math.max(120, state.width - panelBleed);
    const gw = maxX - minX || 1;
    const gh = maxY - minY || 1;
    const k = Math.min(
      (usableW - pad * 2) / gw,
      (state.height - pad * 2) / gh,
      3.5
    );
    const tx = usableW / 2 - k * ((minX + maxX) / 2);
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
    return state.nodes.filter(
      (n) => n.type === "regular_node" && (n.parentId === mega.id || (n.parentIds || []).includes(mega.id))
    );
  }

  function getMegasForTopic(topic) {
    return state.nodes.filter(
      (n) => n.type === "mega_node" && (n.parentId === topic.id || (n.parentIds || []).includes(topic.id))
    );
  }

  function getPostsForTopic(topic) {
    const megaIds = new Set(getMegasForTopic(topic).map((m) => m.id));
    return state.nodes.filter(
      (n) => n.type === "regular_node" && megaIds.has(n.parentId)
    );
  }

  function panelBleedWidth() {
    return panelEl && !panelEl.hidden ? Math.min(PANEL_MAX_W, window.innerWidth * 0.92) : 0;
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
    const pad = 72;
    const usableW = Math.max(120, state.width - bleed);
    const gw = Math.max(maxX - minX, 40);
    const gh = Math.max(maxY - minY, 40);
    const k = Math.min(
      (usableW - pad * 2) / gw,
      (state.height - pad * 2) / gh,
      Math.max(state.baselineZoom || 1, 1) * 4.5
    );
    const tx = usableW / 2 - k * ((minX + maxX) / 2);
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
    el.textContent = key === UNKNOWN_STANCE ? "No data" : (STANCE_LABELS[key] || key);
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

  function appendStanceDistribution(parent, posts) {
    const { total, entries } = computeStanceDistribution(posts);
    const wrap = document.createElement("div");
    wrap.className = "stance-dist";

    const count = document.createElement("div");
    count.className = "panel-count";
    count.textContent = `${total} post${total === 1 ? "" : "s"}`;
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
      bar.appendChild(seg);
    }
    if (![...bar.children].length) {
      const empty = document.createElement("div");
      empty.className = "stance-bar-seg";
      empty.style.width = "100%";
      empty.style.background = "#e2e8f0";
      bar.appendChild(empty);
    }
    wrap.appendChild(bar);

    const legend = document.createElement("div");
    legend.className = "stance-legend";
    for (const e of entries) {
      if (!e.post_count) continue;
      const row = document.createElement("div");
      row.className = "stance-legend-row";

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

      legend.appendChild(row);
    }
    wrap.appendChild(legend);
    appendField(parent, "Stance distribution", wrap);
  }

  function openPostPanel(post) {
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
      appendField(panelBody, "Stance", stanceWrap);

      if (s.content_snippet) {
        const snippet = makeValue(s.content_snippet);
        snippet.classList.add("panel-snippet");
        appendField(panelBody, "Content", snippet);
      }

      if (s.sentiment_reasoning) {
        appendField(panelBody, "Sentiment reasoning", makeValue(s.sentiment_reasoning));
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
      if (s.subtopic) metaBits.push(["Subtopic", s.subtopic]);
      if (s.platform) metaBits.push(["Platform", s.platform]);
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

  function openMegaPanel(mega) {
    const posts = getPostsForMega(mega);
    state.selected = mega;
    state.highlightIds = new Set([mega.id, ...posts.map((p) => p.id)]);
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

    appendStanceDistribution(panelBody, posts);

    const postsField = document.createElement("div");
    postsField.className = "panel-field";
    const postsLab = document.createElement("div");
    postsLab.className = "panel-label";
    postsLab.textContent = "Posts";
    postsField.appendChild(postsLab);

    const postsWrap = document.createElement("div");
    postsWrap.className = "panel-posts";
    if (!posts.length) {
      postsWrap.appendChild(makeValue("No linked posts."));
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
    focusNodes([mega, ...posts]);
  }

  function openMegaMegaPanel(topic) {
    const megas = getMegasForTopic(topic);
    const posts = getPostsForTopic(topic);
    state.selected = topic;
    state.highlightIds = new Set([topic.id, ...megas.map((m) => m.id), ...posts.map((p) => p.id)]);
    showPanelShell("Parent topic");
    panelBody.replaceChildren();

    const topicTitle = topic.rawId || topic.displayLabel || "—";
    const topicMeta =
      topic.label && topic.label !== topicTitle && !topic.label.endsWith(topicTitle)
        ? topic.label
        : null;
    appendPanelHero(panelBody, topicTitle, topicMeta);

    appendStanceDistribution(panelBody, posts);

    const subsField = document.createElement("div");
    subsField.className = "panel-field";
    const subsLab = document.createElement("div");
    subsLab.className = "panel-label";
    subsLab.textContent = `Narratives (${megas.length})`;
    subsField.appendChild(subsLab);

    const subsWrap = document.createElement("div");
    subsWrap.className = "panel-narratives";
    if (!megas.length) {
      subsWrap.appendChild(makeValue("No linked narratives."));
    } else {
      const sorted = megas.slice().sort((a, b) => {
        const da = b.degree || 0;
        const db = a.degree || 0;
        if (da !== db) return da - db;
        return String(a.rawId).localeCompare(String(b.rawId), undefined, { numeric: true });
      });
      for (const mega of sorted) {
        const postCount = getPostsForMega(mega).length;
        subsWrap.appendChild(
          makeNavCard({
            title: mega.narrative || mega.rawId || mega.displayLabel,
            meta: `${postCount} post${postCount === 1 ? "" : "s"}`,
            hint: "Open narrative →",
            color: mega.color || topic.color || null,
            onClick: () => openMegaPanel(mega),
          })
        );
      }
    }
    subsField.appendChild(subsWrap);
    panelBody.appendChild(subsField);

    render();
    focusNodes([topic, ...megas, ...posts]);
  }

  function closePanel() {
    if (!state.selected && panelEl.hidden) return;
    state.selected = null;
    state.highlightIds = null;
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

  // Stance-tinted posts when a narrative is focused, or the single selected post.
  function stancePostHighlightActive() {
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

  function render() {
    const { width, height, transform: t } = state;
    const focusing = megaFocusActive();
    ctx.save();
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // Links: tint by family when possible
    ctx.lineWidth = 1.25 / t.k;
    for (const l of state.links) {
      if (l.kind !== "parent_link") continue;
      const s = l.source;
      const tg = l.target;
      if (!s || !tg || !Number.isFinite(s.x) || !Number.isFinite(tg.x)) continue;
      const related = focusing && (isHighlighted(s) || isHighlighted(tg));
      const parent = s.type === "mega_mega_node" ? s : tg;
      let color = parent.linkColor || hexToRgba(COLORS.orphan, 0.28);
      if (focusing && !related) {
        color = hexToRgba(COLORS.orphan, COLORS.dimAlpha * 0.5);
      } else if (related) {
        color = parent.linkColor || hexToRgba(COLORS.orphan, 0.55);
      }
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tg.x, tg.y);
      ctx.stroke();
    }

    ctx.lineWidth = 1 / t.k;
    for (const l of state.links) {
      if (l.kind === "parent_link") continue;
      const s = l.source;
      const tg = l.target;
      if (!s || !tg || !Number.isFinite(s.x) || !Number.isFinite(tg.x)) continue;
      const related = focusing && isHighlighted(s) && isHighlighted(tg);
      const mega = s.type === "mega_node" ? s : tg.type === "mega_node" ? tg : null;
      let color = mega?.linkColor || hexToRgba(COLORS.postFallback, 0.2);
      if (focusing && !related) {
        color = hexToRgba(COLORS.postFallback, COLORS.dimAlpha * 0.45);
      } else if (related) {
        color = mega?.linkColor
          ? hexToRgba(mega.color || COLORS.orphan, 0.7)
          : hexToRgba(COLORS.postFallback, 0.55);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = (related ? 1.75 : 1) / t.k;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tg.x, tg.y);
      ctx.stroke();
    }

    // Posts — dark gray at rest; sentiment colors when in a narrative (or single-post) selection
    const stanceHighlight = stancePostHighlightActive();
    for (const n of state.nodes) {
      if (n.type !== "regular_node") continue;
      if (!Number.isFinite(n.x)) continue;
      const selected = isHighlighted(n);
      const dimmed = focusing && !selected;
      const sk = stanceKey(n);
      const sc = stanceColor(sk);
      const showStance =
        stanceHighlight &&
        selected &&
        (state.selected?.type === "mega_node" || state.selected === n);
      const r = focusing && selected ? POST_R + 1.75 : selected || state.selected === n ? POST_R + 1 : POST_R;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      if (dimmed) {
        ctx.fillStyle = hexToRgba(COLORS.postFallback, COLORS.dimAlpha);
      } else if (showStance && sc) {
        ctx.fillStyle = lightenHex(sc, 0.55);
      } else {
        ctx.fillStyle = COLORS.postFallback;
      }
      ctx.fill();
      if (showStance) {
        ctx.strokeStyle = sc || COLORS.megaSelectedStroke;
        ctx.lineWidth = 2.25 / t.k;
        ctx.stroke();
      } else if (state.selected === n) {
        ctx.strokeStyle = COLORS.megaSelectedStroke;
        ctx.lineWidth = 1.75 / t.k;
        ctx.stroke();
      }
    }

    const showLabels = t.k >= (state.baselineZoom || 1) * LABEL_ZOOM_MULT;
    const fontSize = 11 / t.k;

    // Megas — inherit family color from parent topic
    for (const n of state.nodes) {
      if (n.type !== "mega_node") continue;
      if (!Number.isFinite(n.x)) continue;
      const hovered = state.hovered === n;
      const selected = isHighlighted(n);
      const dimmed = focusing && !selected;
      const fill = dimmed
        ? hexToRgba(n.color || COLORS.orphan, COLORS.dimAlpha)
        : (n.color || COLORS.orphan);
      const stroke = selected
        ? COLORS.megaSelectedStroke
        : hovered
          ? COLORS.hoverStroke
          : (n.strokeColor || COLORS.orphanStroke);
      const strokeW = (selected ? 3.5 : hovered ? 2.5 : 1.25) / t.k;
      drawNodeCircle(n, fill, stroke, strokeW);
      if (selected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 4 / t.k, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.megaSelectedStroke;
        ctx.lineWidth = 1.25 / t.k;
        ctx.setLineDash([3 / t.k, 2.5 / t.k]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (showLabels && !dimmed) {
        ctx.fillStyle = COLORS.text;
        ctx.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(truncateLabel(n.displayLabel, MEGA_LABEL_MAX_CHARS), n.x, n.y);
      }
    }

    // Mega-megas (draw on top)
    for (const n of state.nodes) {
      if (n.type !== "mega_mega_node") continue;
      if (!Number.isFinite(n.x)) continue;
      const hovered = state.hovered === n;
      const selected = isHighlighted(n) || state.selected === n;
      const dimmed = focusing && !selected;
      const fill = dimmed
        ? hexToRgba(n.color || COLORS.orphan, COLORS.dimAlpha)
        : (n.color || COLORS.orphan);
      const stroke = selected
        ? COLORS.megaSelectedStroke
        : hovered
          ? COLORS.hoverStroke
          : (n.strokeColor || COLORS.orphanStroke);
      const strokeW = (selected ? 3.5 : hovered ? 3 : 1.5) / t.k;
      drawNodeCircle(n, fill, stroke, strokeW);
      if (selected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 5 / t.k, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.megaSelectedStroke;
        ctx.lineWidth = 1.25 / t.k;
        ctx.setLineDash([4 / t.k, 3 / t.k]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Parent-topic labels always visible; world-space size so they grow/shrink with zoom
      ctx.fillStyle = dimmed ? hexToRgba(COLORS.text, COLORS.dimAlpha + 0.15) : COLORS.text;
      ctx.font = `700 ${MEGA_MEGA_LABEL_SIZE}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(truncateLabel(n.displayLabel, MEGA_MEGA_LABEL_MAX_CHARS), n.x, n.y);
    }

    // Anchor indicator on user-pinned parent topics
    for (const n of state.nodes) {
      if (n.type !== "mega_mega_node" || !n.userPinned || !Number.isFinite(n.x)) continue;
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
      ctx.arc(n.x, n.y, POST_R + 1.5 / t.k, 0, Math.PI * 2);
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
    for (const n of state.nodes) {
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
    for (const n of state.nodes) {
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
      render();
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
          // Gentle settle so posts can re-nest if needed, without yanking the pinned parent
          if (state.simulation) {
            state.simulation.alpha(0.12).restart();
          }
          render();
        } else {
          // Click (not drag): drop temporary pins from pointerdown, then open panel
          const { megas, posts } = getClusterMembers(topic);
          if (state.settled) {
            topic.fx = topic.x;
            topic.fy = topic.y;
            for (const m of megas) {
              m.fx = m.x;
              m.fy = m.y;
            }
          }
          for (const p of posts) {
            p.fx = null;
            p.fy = null;
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
      if (event.key === "Escape") closePanel();
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
