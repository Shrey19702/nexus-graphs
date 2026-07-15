(() => {
  // Shared structural colors (Nexus Civic Signal theme)
  const COLORS = {
    bg: "#FAFBFC",
    edge: "#D9DEE4",
    text: "#1F2937",
    mutedText: "#6B7280",
    selectionRing: "#2563EB",
    profileFallback: "#9AA5B1",
    profileSelected: "#9AA5B1",
    postFallback: "#9AA5B1",
    postNoData: "#E9ECF0",
    megaSelectedStroke: "#2563EB",
    hoverStroke: "#6B7280",
    tooltipBg: "rgba(255, 255, 255, 0.96)",
    tooltipText: "#1F2937",
    tooltipBorder: "#D9DEE4",
    orphan: "#9AA5B1",
    orphanStroke: "#CBD2DA",
    dimAlpha: 0.22,
  };

  // One dull color per platform mega-node
  const PLATFORM_PALETTE = [
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

  const CATEGORY_ORDER = ["hub", "promoter", "general"];
  const CATEGORY_COLORS = {
    hub: "#c45c26",
    promoter: "#6b8f71",
    general: "#7d8b99",
  };
  const CATEGORY_LABELS = {
    hub: "Hub",
    promoter: "Promoter",
    general: "General",
  };

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
  const POST_R = 3.25;
  // Gap between profile disc and first hex post lane (mirrors topic-graph LINK_GAP)
  const POST_ORBIT_GAP = 1.25;
  const PROFILE_COLLIDE_PAD = 6;
  const POST_LERP = 0.24;
  const POST_LERP_EPSILON = 0.04;

  const PROFILE_R_DEFAULT = 8.5;
  const MEGA_R_MIN = 14;
  const MEGA_R_MAX = 22;
  const DISTANCE_UNIT_DEFAULT = 50;
  const DISTANCE_BASE = 12;
  const CLUSTER_PITCH = 320;
  const PLATFORM_REPEL = 680;
  const PLATFORM_REPEL_DIST = 520;
  const FOREIGN_PROFILE_REPEL = 28;
  const FOREIGN_PROFILE_DIST_MAX = 56;
  // Soft pull toward assigned lane; nodes may wiggle inside slack, hard-clamped beyond
  const DISTANCE_RING_FORCE = 0.22;
  const RING_SLACK_FRAC = 0.22; // free wiggle as fraction of distanceUnit
  const RING_CLAMP_FRAC = 0.48; // max |radius - nominal| / distanceUnit (stays in band)
  const LINK_STRENGTH = 0.28;
  // Same-parent collide may use this much of the radial impulse to unstack
  const SIBLING_RADIAL_ALLOW = 0.55;
  const LABEL_ZOOM_MULT = 1.55;
  const MEGA_LABEL_MAX_CHARS = 22;
  const MEGA_LABEL_SIZE = 10;
  const PROFILE_LABEL_MAX_CHARS = 16;
  const GOLDEN_ANGLE = 2.399963229728653;
  const CLICK_MOVE_PX = 5;
  const DATA_FILE = "x_profiles_graph.json";
  const SENTIMENT_FILE = "CJP-SEARCH-RESULTS - l1-iteration-1-sentiment.csv";
  const PANEL_MAX_W = 400;
  const SETTINGS_DEFAULTS = {
    distanceUnit: DISTANCE_UNIT_DEFAULT,
    profileSize: PROFILE_R_DEFAULT,
    distanceJitter: 0,
    angleJitter: 0.5,
    sizeJitter: 0,
  };

  const settings = { ...SETTINGS_DEFAULTS };

  const canvas = document.getElementById("graph");
  const ctx = canvas.getContext("2d");
  const zoomLabel = document.getElementById("zoom-label");
  const panelEl = document.getElementById("panel");
  const panelClose = document.getElementById("panel-close");
  const panelTitle = document.getElementById("panel-title");
  const panelBody = document.getElementById("panel-body");
  const settingsEl = document.getElementById("settings");
  const fitViewBtn = document.getElementById("fit-view");
  const settingsToggle = document.getElementById("settings-toggle");
  const settingsClose = document.getElementById("settings-close");
  const settingsReshuffle = document.getElementById("settings-reshuffle");
  const settingsReset = document.getElementById("settings-reset");

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
    rawGraph: null,
    sentimentById: null,
    focusPosts: null,
    postsAnimating: false,
    renderFrame: null,
  };

  let zoomBehavior = null;
  let pointerDown = null;

  function nodeRadius(d) {
    return d.radius ?? (d.type === "mega_node" ? MEGA_R_MIN : settings.profileSize);
  }

  function unitNoise() {
    return Math.random() * 2 - 1;
  }

  function applyProfileJitter(n) {
    if (n.type !== "regular_node") return;
    if (n.seedDist == null) n.seedDist = unitNoise();
    if (n.seedAngle == null) n.seedAngle = unitNoise();
    if (n.seedSize == null) n.seedSize = unitNoise();
    n.orbitScale = 1 + n.seedDist * settings.distanceJitter;
    n.angleJitter = n.seedAngle * settings.angleJitter;
    n.radius = settings.profileSize * (1 + n.seedSize * settings.sizeJitter);
    n.farthestPostDistance = 0;
  }

  function reshuffleProfileSeeds() {
    for (const n of state.nodes) {
      if (n.type !== "regular_node") continue;
      n.seedDist = unitNoise();
      n.seedAngle = unitNoise();
      n.seedSize = unitNoise();
      applyProfileJitter(n);
    }
  }

  function scaleRadius(degree, minR, maxR, maxDeg = 160) {
    const t = Math.sqrt(Math.max(degree, 1));
    const maxT = Math.sqrt(maxDeg);
    const n = Math.min(1, Math.max(0, (t - 1) / (maxT - 1)));
    return minR + n * (maxR - minR);
  }

  function orbitRadius(platform, distance, profile) {
    const d = Math.max(1, Number(distance) || 1);
    const base = platform.radius + DISTANCE_BASE + d * settings.distanceUnit;
    return base * (profile?.orbitScale ?? 1);
  }

  // Per-profile target (packing lane). Falls back to nominal JSON ring.
  function profileRingTarget(profile, platform) {
    if (Number.isFinite(profile.ringTarget)) return profile.ringTarget;
    return orbitRadius(platform, profile.distance, profile);
  }

  // How many concentric lanes + center radius so `count` profiles fit without stacking.
  function packingPlan(platform, distance, count) {
    const d = Math.max(1, Number(distance) || 1);
    const nodeR = settings.profileSize;
    const pitch = 2 * nodeR + 2.75;
    const maxSpread = settings.distanceUnit * RING_CLAMP_FRAC;
    const lanePitch = Math.max(nodeR * 1.85, 1);
    const maxLanes = Math.max(1, Math.floor((2 * maxSpread) / lanePitch) + 1);

    let base = platform.radius + DISTANCE_BASE + d * settings.distanceUnit;
    let lanes = 1;
    while (lanes < maxLanes && lanes * 2 * Math.PI * base < count * pitch) {
      lanes += 1;
    }
    const needed = (count * pitch) / (Math.max(1, lanes) * 2 * Math.PI);
    if (needed > base) base = needed;

    const step = lanes <= 1 ? 0 : Math.min(lanePitch, (2 * maxSpread) / (lanes - 1));
    return { base, lanes, step };
  }

  function categoryColor(category) {
    return CATEGORY_COLORS[category] || COLORS.profileFallback;
  }

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category || "Unknown";
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

  function normalizeProfileUrl(url) {
    if (!url) return "";
    let u = String(url).trim().replace(/\/+$/, "");
    u = u.replace(/^http:\/\//i, "https://");
    u = u.replace(/^https:\/\/www\./i, "https://");
    u = u.replace(/^https:\/\/twitter\.com\//i, "https://x.com/");
    return u.toLowerCase();
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

  function attachPostsToProfiles(records) {
    const byPostId = new Map();
    const byProfile = new Map();
    for (const row of records) {
      if (row.post_id) byPostId.set(String(row.post_id), row);
      const key = normalizeProfileUrl(row.profile_url);
      if (!key) continue;
      if (!byProfile.has(key)) byProfile.set(key, []);
      byProfile.get(key).push(row);
    }
    state.sentimentById = byPostId;

    let matchedProfiles = 0;
    let matchedPosts = 0;
    for (const n of state.nodes) {
      if (n.type !== "regular_node") continue;
      const rows = byProfile.get(normalizeProfileUrl(n.rawId)) || [];
      n.posts = rows.map((row, i) => {
        const stance = row.stance || null;
        const idx = STANCE_ORDER.indexOf(stance);
        return {
          id: `post:${row.post_id || i}:${n.id}`,
          rawId: String(row.post_id || ""),
          type: "post",
          profileId: n.id,
          sentiment: row,
          stance,
          stanceIndex: idx >= 0 ? idx : STANCE_ORDER.length,
          displayLabel: row.content_snippet || String(row.post_id || "Post"),
          radius: POST_R,
          x: null,
          y: null,
        };
      });
      if (n.posts.length) {
        matchedProfiles += 1;
        matchedPosts += n.posts.length;
      }
    }
    console.info(
      `Sentiment linked ${matchedPosts} posts to ${matchedProfiles} profiles (${byPostId.size} CSV rows)`
    );
  }

  function profileCollisionRadius(d) {
    if (!d || d.type !== "regular_node") {
      return d?.radius || settings.profileSize;
    }
    return d.profileCollisionRadius || d.farthestPostDistance || d.radius || settings.profileSize;
  }

  // Hex-lattice stance packing (same pattern as topic-graph narratives).
  // Collision radius = farthest packed post centre from the profile.
  function layoutPostsAroundProfile(profile, { immediate = true } = {}) {
    const posts = profile.posts || [];
    if (!posts.length) {
      profile.farthestPostDistance = 0;
      profile.profileCollisionRadius = profile.radius || settings.profileSize;
      return posts;
    }
    if (!Number.isFinite(profile.x) || !Number.isFinite(profile.y)) return posts;

    const buckets = new Map();
    for (const post of posts) {
      const key = stanceKey(post);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(post);
    }
    const order = [...STANCE_ORDER, UNKNOWN_STANCE].filter((k) => buckets.has(k));
    const spacing = POST_R * 2 + 2.5;
    const bodyR = profile.radius || settings.profileSize;
    const innerRadius = bodyR + POST_ORBIT_GAP + POST_R;
    const rowPitch = (spacing * Math.sqrt(3)) / 2;
    let outerRadius = innerRadius + spacing;
    let slots = [];

    while (slots.length < posts.length) {
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
      if (slots.length < posts.length) outerRadius += spacing;
    }

    slots.sort((a, b) => a.dist - b.dist);
    slots = slots.slice(0, posts.length);
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
        post.x = profile.x + post.localX;
        post.y = profile.y + post.localY;
      }
    }

    profile.farthestPostDistance = slots.length
      ? Math.max(...slots.map((slot) => slot.dist))
      : bodyR;
    profile.profileCollisionRadius = profile.farthestPostDistance;
    return posts;
  }

  function syncPostWorldPositions(advance = false) {
    let animating = false;
    for (const n of state.nodes) {
      if (n.type !== "regular_node" || !n.posts?.length) continue;
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      for (const post of n.posts) {
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
        post.x = n.x + (post.localX || 0);
        post.y = n.y + (post.localY || 0);
      }
    }
    if (advance) state.postsAnimating = animating;
    return advance ? animating : state.postsAnimating;
  }

  function layoutAllPosts({ immediate = false } = {}) {
    for (const n of state.nodes) {
      if (n.type === "regular_node") layoutPostsAroundProfile(n, { immediate });
    }
    syncPostWorldPositions();
    if (state.postsAnimating) requestRender();
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

  function forEachPost(fn) {
    for (const n of state.nodes) {
      if (n.type !== "regular_node" || !n.posts?.length) continue;
      for (const post of n.posts) fn(post, n);
    }
  }

  function isPostInFocus(post) {
    if (!platformFocusActive() && !profileFocusActive()) return true;
    if (profileFocusActive()) return post.profileId === focusedProfileId();
    if (platformFocusActive()) return isHighlighted({ id: post.profileId });
    return true;
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
      if (!postCount) continue;
      entries.push({
        stance: key,
        post_count: postCount,
        percentage: total ? Math.round((postCount / total) * 10000) / 100 : 0,
        color: stanceColor(key),
        label: key === UNKNOWN_STANCE ? "No sentiment" : STANCE_LABELS[key] || key,
      });
    }
    return { total, entries };
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

  // Strip the radial component of an impulse relative to a profile's platform parent.
  // Separation still happens, but only as shear around the distance ring.
  function orbitShearImpulse(node, fx, fy) {
    if (node.type !== "regular_node" || node.parentId == null) {
      return { fx, fy };
    }
    const platform = state.byId.get(node.parentId);
    if (
      !platform ||
      !Number.isFinite(platform.x) ||
      !Number.isFinite(platform.y) ||
      !Number.isFinite(node.x) ||
      !Number.isFinite(node.y)
    ) {
      return { fx, fy };
    }
    const rx = node.x - platform.x;
    const ry = node.y - platform.y;
    const r2 = rx * rx + ry * ry;
    if (r2 < 1e-8) return { fx, fy };
    const radial = (fx * rx + fy * ry) / r2;
    return { fx: fx - radial * rx, fy: fy - radial * ry };
  }

  function applyOrbitShear(node, fx, fy) {
    applyOrbitImpulse(node, fx, fy, 0);
  }

  // radialAllow 0 = pure shear; 1 = full impulse. Sibling unstack uses a little radial.
  function applyOrbitImpulse(node, fx, fy, radialAllow = 0) {
    if (radialAllow >= 1 || node.type !== "regular_node" || node.parentId == null) {
      node.vx = (node.vx || 0) + fx;
      node.vy = (node.vy || 0) + fy;
      return;
    }
    const shear = orbitShearImpulse(node, fx, fy);
    const allow = Math.max(0, Math.min(1, radialAllow));
    node.vx = (node.vx || 0) + shear.fx + (fx - shear.fx) * allow;
    node.vy = (node.vy || 0) + shear.fy + (fy - shear.fy) * allow;
  }

  function forceForeignClusterRepel(opts) {
    const { type, parentKey, strength, distanceMax } = opts;
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

      const tree = d3.quadtree(
        items,
        (d) => d.x,
        (d) => d.y
      );
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
            applyOrbitShear(a, -fx, -fy);
            applyOrbitShear(b, fx, fy);
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

  // Soft spring toward each profile's packing lane; hard clamp to the JSON
  // distance band so nodes cannot drift into neighboring distance classes.
  function enforceOrbitRadii(strength = DISTANCE_RING_FORCE) {
    const unit = settings.distanceUnit;
    const slack = unit * RING_SLACK_FRAC;
    const hard = unit * RING_CLAMP_FRAC;
    const s = Math.min(1, Math.max(0, strength));

    for (const n of state.nodes) {
      if (n.type !== "regular_node" || n.parentId == null) continue;
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      const platform = state.byId.get(n.parentId);
      if (!platform || !Number.isFinite(platform.x) || !Number.isFinite(platform.y)) continue;

      const dx = n.x - platform.x;
      const dy = n.y - platform.y;
      const dist = Math.hypot(dx, dy) || 1e-6;
      const nominal = orbitRadius(platform, n.distance, n);
      const target = profileRingTarget(n, platform);
      const ux = dx / dist;
      const uy = dy / dist;

      // Keep inside the JSON distance band (around nominal), not the whole graph
      const bandErr = dist - nominal;
      if (Math.abs(bandErr) > hard) {
        const clamped = nominal + Math.sign(bandErr) * hard;
        n.x = platform.x + ux * clamped;
        n.y = platform.y + uy * clamped;
        const vr = (n.vx || 0) * ux + (n.vy || 0) * uy;
        if (bandErr > 0 && vr > 0) {
          n.vx -= vr * ux;
          n.vy -= vr * uy;
        } else if (bandErr < 0 && vr < 0) {
          n.vx -= vr * ux;
          n.vy -= vr * uy;
        }
      }

      const laneDist = Math.hypot(n.x - platform.x, n.y - platform.y) || 1e-6;
      const laneErr = laneDist - target;
      const soft = Math.abs(laneErr) <= slack ? s * 0.25 : s;
      const pull = (target - laneDist) * soft;
      n.vx = (n.vx || 0) + ux * pull;
      n.vy = (n.vy || 0) + uy * pull;
    }
  }

  function forceDistanceRings(strength) {
    function force(alpha) {
      enforceOrbitRadii(strength * (0.65 + 0.35 * alpha));
    }
    force.initialize = () => {};
    return force;
  }

  // Direct position push for overlapping siblings — velocity-only collide was too weak
  // once alpha cooled, so dense rings stayed stacked. Uses post-cloud collision radii.
  function resolveSiblingOverlaps(iterations = 4) {
    const byParent = new Map();
    for (const n of state.nodes) {
      if (n.type !== "regular_node" || n.parentId == null) continue;
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
      byParent.get(n.parentId).push(n);
    }

    for (const [, group] of byParent) {
      if (group.length < 2) continue;
      for (let iter = 0; iter < iterations; iter += 1) {
        const tree = d3.quadtree(
          group,
          (d) => d.x,
          (d) => d.y
        );
        for (const a of group) {
          const ra = profileCollisionRadius(a) + PROFILE_COLLIDE_PAD * 0.5;
          const reach = ra * 2.4;
          tree.visit((quad, x0, y0, x1, y1) => {
            const b = quad.data;
            if (b) {
              if (a === b || a.id >= b.id) return;
              const rb = profileCollisionRadius(b) + PROFILE_COLLIDE_PAD * 0.5;
              const minDist = ra + rb;
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist2 = dx * dx + dy * dy;
              if (dist2 === 0 || dist2 >= minDist * minDist) return;
              const dist = Math.sqrt(dist2);
              const push = ((minDist - dist) / dist) * 0.55;
              let fx = dx * push;
              let fy = dy * push;

              const platform = state.byId.get(a.parentId);
              if (platform && Number.isFinite(platform.x)) {
                // Prefer shear; keep a slice of radial so lanes can stagger
                const mx = (a.x + b.x) / 2 - platform.x;
                const my = (a.y + b.y) / 2 - platform.y;
                const m2 = mx * mx + my * my || 1;
                const radial = (fx * mx + fy * my) / m2;
                fx = fx - radial * mx * (1 - SIBLING_RADIAL_ALLOW);
                fy = fy - radial * my * (1 - SIBLING_RADIAL_ALLOW);
              }

              a.x -= fx;
              a.y -= fy;
              b.x += fx;
              b.y += fy;
              return;
            }
            return x0 > a.x + reach || x1 < a.x - reach || y0 > a.y + reach || y1 < a.y - reach;
          });
        }
      }
    }
  }

  // Profile collisions reserve each profile's farthest packed post centre.
  function forceProfileShearCollide(strength = 1) {
    let nodes = [];

    function force(alpha) {
      const profiles = [];
      const platforms = [];
      for (const n of nodes) {
        if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
        if (n.type === "regular_node") profiles.push(n);
        else if (n.type === "mega_node") platforms.push(n);
      }
      if (!profiles.length) return;

      const s = strength * alpha;
      const tree = d3.quadtree(
        profiles,
        (d) => d.x,
        (d) => d.y
      );

      for (const a of profiles) {
        const ra = profileCollisionRadius(a) + PROFILE_COLLIDE_PAD;
        const reach = ra * 2.5;
        tree.visit((quad, x0, y0, x1, y1) => {
          const b = quad.data;
          if (b) {
            if (a === b || a.id >= b.id) return;
            const rb = profileCollisionRadius(b) + PROFILE_COLLIDE_PAD;
            const minDist = ra + rb;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 === 0 || dist2 >= minDist * minDist) return;
            const dist = Math.sqrt(dist2);
            const mag = ((minDist - dist) / dist) * s;
            const fx = dx * mag;
            const fy = dy * mag;
            const siblings = a.parentId != null && a.parentId === b.parentId;
            const radial = siblings ? SIBLING_RADIAL_ALLOW : 0;
            applyOrbitImpulse(a, -fx, -fy, radial);
            applyOrbitImpulse(b, fx, fy, radial);
            return;
          }
          return x0 > a.x + reach || x1 < a.x - reach || y0 > a.y + reach || y1 < a.y - reach;
        });
      }

      for (const a of profiles) {
        const ra = profileCollisionRadius(a) + PROFILE_COLLIDE_PAD;
        for (const p of platforms) {
          if (a.parentId === p.id) continue;
          const rb = p.radius || MEGA_R_MIN;
          const minDist = ra + rb + 2;
          const dx = a.x - p.x;
          const dy = a.y - p.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 === 0 || dist2 >= minDist * minDist) continue;
          const dist = Math.sqrt(dist2);
          const mag = ((minDist - dist) / dist) * s;
          applyOrbitShear(a, dx * mag, dy * mag);
          if (p.fx == null) {
            p.vx = (p.vx || 0) - dx * mag;
            p.vy = (p.vy || 0) - dy * mag;
          }
        }
      }
    }

    force.initialize = (initNodes) => {
      nodes = initNodes;
    };
    return force;
  }

  function forcePlatformCollide() {
    const f = d3
      .forceCollide()
      .radius((d) => d.radius + DISTANCE_BASE + settings.distanceUnit * 0.35)
      .strength(0.9)
      .iterations(2);
    const base = f.initialize;
    f.initialize = (nodes, random) =>
      base.call(
        f,
        nodes.filter((d) => d.type === "mega_node"),
        random
      );
    return f;
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
      mega_node: new Map(),
      regular_node: new Map(),
    };
    for (const n of nodes) {
      byTypeRaw[n.type]?.set(n.rawId, n);
    }
    return byTypeRaw;
  }

  function resolveEndpoint(rawId, role, byTypeRaw, otherRawId) {
    if (role === "target") {
      return byTypeRaw.regular_node.get(rawId) || byTypeRaw.mega_node.get(rawId) || null;
    }

    const targetGuess =
      byTypeRaw.regular_node.get(otherRawId) || byTypeRaw.mega_node.get(otherRawId);

    if (targetGuess?.type === "regular_node") {
      return byTypeRaw.mega_node.get(rawId) || byTypeRaw.regular_node.get(rawId) || null;
    }
    return byTypeRaw.mega_node.get(rawId) || byTypeRaw.regular_node.get(rawId) || null;
  }

  function platformDisplayName(rawId, label) {
    const src = label || rawId || "";
    return src.replace(/^Platform:\s*/i, "").trim() || src;
  }

  function loadGraph(data) {
    const nodes = (data.nodes || []).map((n, i) => ({
      id: i,
      rawId: n.id,
      type: n.type,
      label: n.label || "",
      category: n.category || null,
      radius: settings.profileSize,
      degree: 0,
      parentId: null,
      parentIds: [],
      distance: null,
      displayLabel: "",
    }));

    const byTypeRaw = typedIndex(nodes);
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const links = [];
    for (const l of data.links || []) {
      const src = resolveEndpoint(l.source, "source", byTypeRaw, l.target);
      const tgt = resolveEndpoint(l.target, "target", byTypeRaw, l.source);
      if (!src || !tgt || src.id === tgt.id) continue;

      const distance = Number(l.distance);
      links.push({
        source: src.id,
        target: tgt.id,
        distance: Number.isFinite(distance) && distance > 0 ? distance : 1,
        kind: "profile_link",
      });
    }

    const profileParents = new Map();
    const profileDistance = new Map();

    for (const l of links) {
      const src = byId.get(l.source);
      const tgt = byId.get(l.target);
      if (!src || !tgt) continue;

      let platform = null;
      let profile = null;
      if (src.type === "mega_node" && tgt.type === "regular_node") {
        platform = src;
        profile = tgt;
      } else if (tgt.type === "mega_node" && src.type === "regular_node") {
        platform = tgt;
        profile = src;
      } else {
        continue;
      }

      if (!profileParents.has(profile.id)) profileParents.set(profile.id, []);
      const list = profileParents.get(profile.id);
      if (!list.includes(platform.id)) list.push(platform.id);
      if (!profileDistance.has(profile.id) || l.distance < profileDistance.get(profile.id)) {
        profileDistance.set(profile.id, l.distance);
      }
    }

    const degree = new Map(nodes.map((n) => [n.id, 0]));
    for (const l of links) {
      degree.set(l.source, (degree.get(l.source) || 0) + 1);
      degree.set(l.target, (degree.get(l.target) || 0) + 1);
    }

    for (const n of nodes) {
      n.degree = degree.get(n.id) || 0;
      if (n.type === "mega_node") {
        n.radius = scaleRadius(n.degree, MEGA_R_MIN, MEGA_R_MAX, 160);
        n.displayLabel = platformDisplayName(n.rawId, n.label);
      } else {
        n.displayLabel = n.label || n.rawId;
        n.parentIds = profileParents.get(n.id) || [];
        n.parentId = n.parentIds[0] ?? null;
        n.distance = profileDistance.get(n.id) ?? 1;
        n.posts = n.posts || [];
        applyProfileJitter(n);
      }
    }

    const platforms = nodes
      .filter((n) => n.type === "mega_node")
      .sort((a, b) => a.id - b.id);
    platforms.forEach((p, i) => {
      const fill = PLATFORM_PALETTE[i % PLATFORM_PALETTE.length];
      p.color = fill;
      p.strokeColor = darkenHex(fill, 0.28);
      p.linkColor = hexToRgba(fill, 0.28);
    });

    for (const n of nodes) {
      if (n.type !== "regular_node") continue;
      const catFill = categoryColor(n.category);
      n.color = catFill;
      n.strokeColor = darkenHex(catFill, 0.25);
    }

    state.nodes = nodes;
    state.links = links;
    state.byId = byId;
  }

  function seedPositions({ keepPlatforms = false } = {}) {
    const cx = state.width / 2;
    const cy = state.height / 2;
    const platforms = state.nodes.filter((n) => n.type === "mega_node");
    const profiles = state.nodes.filter((n) => n.type === "regular_node");
    const platformById = new Map(platforms.map((n) => [n.id, n]));

    platforms.sort((a, b) => (b.degree || 0) - (a.degree || 0));
    const platformScale = CLUSTER_PITCH / Math.sqrt(Math.PI);
    platforms.forEach((p, i) => {
      if (!(keepPlatforms && Number.isFinite(p.x) && Number.isFinite(p.y))) {
        if (platforms.length === 1) {
          p.x = cx;
          p.y = cy;
        } else {
          const r = platformScale * Math.sqrt(i + 0.5);
          const angle = i * GOLDEN_ANGLE;
          p.x = cx + Math.cos(angle) * r;
          p.y = cy + Math.sin(angle) * r;
        }
      }
      p.vx = 0;
      p.vy = 0;
      if (p.userPinned || keepPlatforms) {
        p.fx = p.x;
        p.fy = p.y;
      } else {
        p.fx = null;
        p.fy = null;
      }
    });

    const profilesByParent = new Map();
    for (const profile of profiles) {
      const parent = profile.parentId != null ? platformById.get(profile.parentId) : null;
      if (!parent || !Number.isFinite(parent.x)) {
        profile.x = cx + (Math.random() - 0.5) * 40;
        profile.y = cy + (Math.random() - 0.5) * 40;
        profile.vx = 0;
        profile.vy = 0;
        profile.fx = null;
        profile.fy = null;
        continue;
      }
      if (!profilesByParent.has(profile.parentId)) profilesByParent.set(profile.parentId, []);
      profilesByParent.get(profile.parentId).push(profile);
    }

    for (const [, group] of profilesByParent) {
      const parent = platformById.get(group[0].parentId);
      placeProfilesByDistance(parent, group);
    }
  }

  function placeProfilesByDistance(parent, group) {
    const buckets = new Map();
    for (const profile of group) {
      const key = Math.max(1, Number(profile.distance) || 1);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(profile);
    }

    const distances = [...buckets.keys()].sort((a, b) => a - b);
    for (const distance of distances) {
      const bucket = buckets.get(distance);
      bucket.sort((a, b) => String(a.displayLabel).localeCompare(String(b.displayLabel)));
      const { base, lanes, step } = packingPlan(parent, distance, bucket.length);
      const slot = (Math.PI * 2) / bucket.length;
      bucket.forEach((profile, i) => {
        const lane = lanes <= 1 ? 0 : i % lanes;
        const laneOffset = lanes <= 1 ? 0 : (lane - (lanes - 1) / 2) * step;
        const scale = profile.orbitScale ?? 1;
        const ring = (base + laneOffset) * scale;
        profile.ringTarget = ring;
        const baseAngle = -Math.PI / 2 + (i + 0.5) * slot;
        const angle = baseAngle + (profile.angleJitter ?? 0) * slot * 0.35;
        profile.x = parent.x + Math.cos(angle) * ring;
        profile.y = parent.y + Math.sin(angle) * ring;
        profile.vx = 0;
        profile.vy = 0;
        profile.fx = null;
        profile.fy = null;
      });
    }
  }

  function applySettingsLive({ reshuffle = false } = {}) {
    if (!state.nodes.length) return;
    if (reshuffle) reshuffleProfileSeeds();
    else {
      for (const n of state.nodes) applyProfileJitter(n);
    }
    seedPositions({ keepPlatforms: true });
    layoutAllPosts({ immediate: true });
    state.settled = false;
    startSimulation();
    render();
  }

  function settingsBleedWidth() {
    return settingsEl && !settingsEl.hidden ? Math.min(300, window.innerWidth * 0.92) : 0;
  }

  function syncSettingControls(key) {
    const range = document.getElementById(`set-${key}`);
    const num = document.getElementById(`num-${key}`);
    if (!range || !num) return;

    let display;
    if (key === "jitterAll") {
      const vals = [settings.distanceJitter, settings.angleJitter, settings.sizeJitter];
      const same = vals.every((v) => Math.abs(v - vals[0]) < 1e-9);
      display = same ? Math.round(vals[0] * 100) : "";
      range.value = same ? String(Math.round(vals[0] * 100)) : String(Math.round(vals[0] * 100));
      num.value = display;
      return;
    }
    if (key === "distanceJitter" || key === "angleJitter" || key === "sizeJitter") {
      display = Math.round(settings[key] * 100);
    } else if (key === "profileSize") {
      display = Math.round(settings[key] * 10) / 10;
    } else {
      display = settings[key];
    }
    range.value = String(display);
    num.value = String(display);
  }

  function syncAllSettingControls() {
    for (const key of [
      "distanceUnit",
      "profileSize",
      "jitterAll",
      "distanceJitter",
      "angleJitter",
      "sizeJitter",
    ]) {
      syncSettingControls(key);
    }
  }

  function setSettingFromUi(key, rawValue, { fromAll = false } = {}) {
    let value = Number(rawValue);
    if (!Number.isFinite(value)) return;

    if (key === "jitterAll") {
      value = Math.max(0, Math.min(50, value)) / 100;
      settings.distanceJitter = value;
      settings.angleJitter = value;
      settings.sizeJitter = value;
      syncAllSettingControls();
      applySettingsLive();
      return;
    }

    if (key === "distanceJitter" || key === "angleJitter" || key === "sizeJitter") {
      value = Math.max(0, Math.min(50, value)) / 100;
      settings[key] = value;
      if (!fromAll) syncSettingControls("jitterAll");
    } else if (key === "profileSize") {
      value = Math.max(1, Math.min(12, value));
      settings.profileSize = value;
    } else if (key === "distanceUnit") {
      value = Math.max(10, Math.min(100, Math.round(value)));
      settings.distanceUnit = value;
    }

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

    for (const key of [
      "distanceUnit",
      "profileSize",
      "jitterAll",
      "distanceJitter",
      "angleJitter",
      "sizeJitter",
    ]) {
      bindPair(key);
    }

    settingsToggle?.addEventListener("click", () => {
      setSettingsOpen(!!settingsEl.hidden);
    });
    settingsClose?.addEventListener("click", () => setSettingsOpen(false));
    settingsReshuffle?.addEventListener("click", () => applySettingsLive({ reshuffle: true }));
    settingsReset?.addEventListener("click", () => {
      Object.assign(settings, SETTINGS_DEFAULTS);
      syncAllSettingControls();
      applySettingsLive({ reshuffle: true });
    });
  }

  function linkDistance(l) {
    const s = typeof l.source === "object" ? l.source : state.byId.get(l.source);
    const t = typeof l.target === "object" ? l.target : state.byId.get(l.target);
    if (!s || !t) return 60;

    const platform = s.type === "mega_node" ? s : t.type === "mega_node" ? t : null;
    const profile = s.type === "regular_node" ? s : t.type === "regular_node" ? t : null;
    if (platform && profile) {
      return profileRingTarget(profile, platform);
    }
    return 80;
  }

  function linkStrength() {
    return LINK_STRENGTH;
  }

  function startSimulation() {
    if (state.simulation) state.simulation.stop();

    state.simulation = d3
      .forceSimulation(state.nodes)
      .alpha(1)
      .alphaMin(0.001)
      .alphaDecay(0.028)
      .velocityDecay(0.35)
      .force(
        "link",
        d3
          .forceLink(state.links)
          .id((d) => d.id)
          .distance(linkDistance)
          .strength(linkStrength)
      )
      .force(
        "repelPlatforms",
        typeRepel(PLATFORM_REPEL, PLATFORM_REPEL_DIST, (d) => d.type === "mega_node")
      )
      .force(
        "repelForeignProfiles",
        forceForeignClusterRepel({
          type: "regular_node",
          parentKey: "parentId",
          strength: FOREIGN_PROFILE_REPEL,
          distanceMax: FOREIGN_PROFILE_DIST_MAX,
        })
      )
      .force("collisionPlatforms", forcePlatformCollide())
      .force("collisionProfiles", forceProfileShearCollide(1))
      // Soft ring spring + hard outer clamp (runs last)
      .force("distanceRings", forceDistanceRings(DISTANCE_RING_FORCE))
      .on("tick", onTick)
      .on("end", onSimEnd);
  }

  function onTick() {
    resolveSiblingOverlaps(3);
    enforceOrbitRadii(DISTANCE_RING_FORCE * 0.35);
    syncPostWorldPositions();
    if (state.dragging || state.simulation.alpha() > 0.02 || state.hovered || state.selected || state.postsAnimating) {
      render();
    }
  }

  function onSimEnd() {
    for (const n of state.nodes) {
      if (n.type === "mega_node") {
        if (n.userPinned) {
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

  function getClusterMembers(platform) {
    const profiles = state.nodes.filter(
      (n) => n.type === "regular_node" && n.parentId === platform.id
    );
    return { parent: platform, profiles, all: [platform, ...profiles] };
  }

  function translateCluster(platform, dx, dy) {
    const { all } = getClusterMembers(platform);
    for (const n of all) {
      n.x += dx;
      n.y += dy;
      if (n.fx != null) n.fx += dx;
      if (n.fy != null) n.fy += dy;
      n.vx = 0;
      n.vy = 0;
    }
    syncPostWorldPositions();
  }

  function pinClusterForDrag(platform) {
    const { all } = getClusterMembers(platform);
    for (const n of all) {
      n.fx = n.x;
      n.fy = n.y;
      n.vx = 0;
      n.vy = 0;
    }
  }

  function finalizeClusterDrag(platform) {
    const { parent, profiles } = getClusterMembers(platform);
    parent.userPinned = true;
    parent.fx = parent.x;
    parent.fy = parent.y;
    for (const p of profiles) {
      p.fx = null;
      p.fy = null;
    }
  }

  function fitGraphToView() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of state.nodes) {
      const r =
        n.type === "regular_node" ? profileCollisionRadius(n) + POST_R : nodeRadius(n);
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      minX = Math.min(minX, n.x - r);
      minY = Math.min(minY, n.y - r);
      maxX = Math.max(maxX, n.x + r);
      maxY = Math.max(maxY, n.y + r);
    }
    if (!Number.isFinite(minX)) return;

    const left = settingsBleedWidth();
    const right = panelBleedWidth();
    const pad = 56;
    const usableW = Math.max(120, state.width - left - right);
    const gw = maxX - minX || 1;
    const gh = maxY - minY || 1;
    const k = Math.min((usableW - pad * 2) / gw, (state.height - pad * 2) / gh, 3.5);
    const tx = left + usableW / 2 - k * ((minX + maxX) / 2);
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

  function getProfilesForPlatform(platform) {
    return state.nodes.filter(
      (n) =>
        n.type === "regular_node" &&
        (n.parentId === platform.id || (n.parentIds || []).includes(platform.id))
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

  function makeLink(href, label) {
    const a = document.createElement("a");
    a.className = "panel-link";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label || href;
    return a;
  }

  function makeCategoryBadge(category) {
    const el = document.createElement("span");
    el.className = "stance-badge";
    el.style.setProperty("--stance-color", categoryColor(category));
    el.textContent = categoryLabel(category);
    return el;
  }

  function makeStanceBadge(stance) {
    const el = document.createElement("span");
    el.className = "stance-badge";
    const key = stance && STANCE_COLORS[stance] ? stance : UNKNOWN_STANCE;
    el.style.setProperty("--stance-color", stanceColor(key));
    el.textContent = key === UNKNOWN_STANCE ? "No sentiment" : STANCE_LABELS[key] || key;
    return el;
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
      empty.style.background = COLORS.postNoData;
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
    appendField(parent, "Sentiment distribution", wrap);
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

    const left = settingsBleedWidth();
    const right = panelBleedWidth();
    const pad = 72;
    const usableW = Math.max(120, state.width - left - right);
    const gw = Math.max(maxX - minX, 40);
    const gh = Math.max(maxY - minY, 40);
    const k = Math.min(
      (usableW - pad * 2) / gw,
      (state.height - pad * 2) / gh,
      Math.max(state.baselineZoom || 1, 1) * 4.5
    );
    const tx = left + usableW / 2 - k * ((minX + maxX) / 2);
    const ty = state.height / 2 - k * ((minY + maxY) / 2);
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);

    d3.select(canvas)
      .transition()
      .duration(420)
      .ease(d3.easeCubicOut)
      .call(zoomBehavior.transform, t);
  }

  function computeCategoryDistribution(profiles) {
    const counts = Object.create(null);
    for (const key of CATEGORY_ORDER) counts[key] = 0;
    counts.unknown = 0;
    for (const p of profiles) {
      const key = CATEGORY_COLORS[p.category] ? p.category : "unknown";
      counts[key] = (counts[key] || 0) + 1;
    }
    const total = profiles.length;
    const entries = [];
    for (const key of [...CATEGORY_ORDER, "unknown"]) {
      const count = counts[key] || 0;
      if (!count) continue;
      entries.push({
        key,
        count,
        percentage: total ? Math.round((count / total) * 10000) / 100 : 0,
        color: key === "unknown" ? COLORS.profileFallback : categoryColor(key),
        label: key === "unknown" ? "Unknown" : categoryLabel(key),
      });
    }
    return { total, entries };
  }

  function computeDistanceDistribution(profiles) {
    const counts = new Map();
    for (const p of profiles) {
      const d = Math.max(1, Number(p.distance) || 1);
      counts.set(d, (counts.get(d) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([distance, count]) => ({ distance, count }));
  }

  function appendCategoryDistribution(parent, profiles) {
    const { total, entries } = computeCategoryDistribution(profiles);
    const wrap = document.createElement("div");
    wrap.className = "stance-dist";

    const count = document.createElement("div");
    count.className = "panel-count";
    count.textContent = `${total} profile${total === 1 ? "" : "s"}`;
    wrap.appendChild(count);

    const bar = document.createElement("div");
    bar.className = "stance-bar";
    for (const e of entries) {
      const seg = document.createElement("div");
      seg.className = "stance-bar-seg";
      seg.style.width = `${e.percentage}%`;
      seg.style.background = e.color;
      seg.title = `${e.label}: ${e.count} (${e.percentage}%)`;
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
      meta.textContent = `${e.count} · ${e.percentage}%`;
      row.appendChild(meta);

      legend.appendChild(row);
    }
    wrap.appendChild(legend);
    appendField(parent, "Category distribution", wrap);
  }

  function openProfilePanel(profile) {
    const posts = layoutPostsAroundProfile(profile);
    state.selected = profile;
    state.focusPosts = posts;
    state.highlightIds = new Set([profile.id, ...(profile.parentIds || [])]);
    showPanelShell("Profile");
    panelBody.replaceChildren();

    appendField(panelBody, "Handle", makeValue(profile.displayLabel || profile.label || "—"));
    appendField(panelBody, "Profile URL", makeLink(profile.rawId, profile.rawId));

    const catWrap = document.createElement("div");
    catWrap.className = "stance-inline";
    catWrap.appendChild(makeCategoryBadge(profile.category));
    appendField(panelBody, "Category", catWrap);

    appendField(panelBody, "Distance", makeValue(String(profile.distance ?? "—")));

    const platformsWrap = document.createElement("div");
    platformsWrap.className = "panel-narratives";
    const parentIds = profile.parentIds || (profile.parentId != null ? [profile.parentId] : []);
    if (!parentIds.length) {
      platformsWrap.appendChild(makeValue("No linked platform."));
    } else {
      for (const pid of parentIds) {
        const platform = state.byId.get(pid);
        const card = document.createElement("div");
        card.className = "narrative-card";
        const title = document.createElement("div");
        title.className = "narrative-card-title";
        title.textContent = platform
          ? platform.displayLabel || platform.rawId
          : String(pid);
        card.appendChild(title);
        platformsWrap.appendChild(card);
      }
    }
    appendField(panelBody, "Platform", platformsWrap);

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
      postsWrap.appendChild(makeValue("No linked sentiment posts for this profile."));
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
          : post.displayLabel || post.rawId;
        card.appendChild(title);

        postsWrap.appendChild(card);
      }
    }
    postsField.appendChild(postsWrap);
    panelBody.appendChild(postsField);

    render();
    focusNodes([profile, ...posts]);
  }

  function openPostPanel(post) {
    const profile = state.byId.get(post.profileId);
    state.selected = post;
    state.focusPosts = profile ? layoutPostsAroundProfile(profile) : [post];
    state.highlightIds = new Set(
      [post.id, post.profileId, ...(profile?.parentIds || [])].filter((id) => id != null)
    );
    showPanelShell("Post");
    panelBody.replaceChildren();

    appendField(panelBody, "Post ID", makeValue(post.rawId, true));

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
      if (s.profile_url) metaBits.push(["Profile", s.profile_url]);
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
      appendField(panelBody, "Sentiment", makeValue("No sentiment row for this post."));
    }

    if (profile) {
      const card = document.createElement("div");
      card.className = "narrative-card";
      const title = document.createElement("div");
      title.className = "narrative-card-title";
      title.textContent = profile.displayLabel || profile.rawId;
      card.appendChild(title);
      const meta = document.createElement("div");
      meta.className = "narrative-card-meta";
      meta.textContent = `${categoryLabel(profile.category)} · ${(profile.posts || []).length} posts`;
      card.appendChild(meta);
      const wrap = document.createElement("div");
      wrap.className = "panel-narratives";
      wrap.appendChild(card);
      appendField(panelBody, "Profile", wrap);
    }

    render();
    if (profile) focusNodes([profile, ...state.focusPosts]);
  }

  function openPlatformPanel(platform) {
    const profiles = getProfilesForPlatform(platform);
    state.selected = platform;
    state.focusPosts = null;
    state.highlightIds = new Set([platform.id, ...profiles.map((p) => p.id)]);
    showPanelShell("Platform");
    panelBody.replaceChildren();

    appendField(panelBody, "Platform", makeValue(platform.displayLabel || platform.rawId));
    appendField(panelBody, "ID", makeValue(platform.rawId, true));

    appendCategoryDistribution(panelBody, profiles);

    const distRows = computeDistanceDistribution(profiles);
    if (distRows.length) {
      const wrap = document.createElement("div");
      wrap.className = "stance-legend";
      for (const row of distRows) {
        const el = document.createElement("div");
        el.className = "stance-legend-row";
        const name = document.createElement("span");
        name.className = "stance-legend-name";
        name.textContent = `Distance ${row.distance}`;
        el.appendChild(name);
        const meta = document.createElement("span");
        meta.className = "stance-legend-meta";
        meta.textContent = String(row.count);
        el.appendChild(meta);
        wrap.appendChild(el);
      }
      appendField(panelBody, "Distance rings", wrap);
    }

    const profilesField = document.createElement("div");
    profilesField.className = "panel-field";
    const profilesLab = document.createElement("div");
    profilesLab.className = "panel-label";
    profilesLab.textContent = "Profiles";
    profilesField.appendChild(profilesLab);

    const profilesWrap = document.createElement("div");
    profilesWrap.className = "panel-posts";
    if (!profiles.length) {
      profilesWrap.appendChild(makeValue("No linked profiles."));
    } else {
      const sorted = profiles.slice().sort((a, b) => {
        const da = a.distance ?? 99;
        const db = b.distance ?? 99;
        if (da !== db) return da - db;
        const ca = CATEGORY_ORDER.indexOf(a.category);
        const cb = CATEGORY_ORDER.indexOf(b.category);
        if (ca !== cb) return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb);
        return String(a.displayLabel).localeCompare(String(b.displayLabel));
      });
      for (const profile of sorted) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "post-card post-card-btn";
        card.style.borderLeftColor = categoryColor(profile.category);
        card.addEventListener("click", () => openProfilePanel(profile));

        const top = document.createElement("div");
        top.className = "post-card-top";
        top.appendChild(makeCategoryBadge(profile.category));
        const distMeta = document.createElement("span");
        distMeta.className = "stance-inline-meta";
        distMeta.textContent = `d=${profile.distance ?? "—"}`;
        top.appendChild(distMeta);
        card.appendChild(top);

        const title = document.createElement("div");
        title.className = "post-card-title";
        const postCount = (profile.posts || []).length;
        title.textContent = postCount
          ? `${profile.displayLabel || profile.label || profile.rawId} · ${postCount} posts`
          : profile.displayLabel || profile.label || profile.rawId;
        card.appendChild(title);

        const idEl = document.createElement("div");
        idEl.className = "post-card-id";
        idEl.textContent = profile.rawId;
        card.appendChild(idEl);

        profilesWrap.appendChild(card);
      }
    }
    profilesField.appendChild(profilesWrap);
    panelBody.appendChild(profilesField);

    render();
    focusNodes([platform, ...profiles]);
  }

  function closePanel() {
    if (!state.selected && panelEl.hidden) return;
    state.selected = null;
    state.highlightIds = null;
    state.focusPosts = null;
    document.body.classList.remove("panel-open");
    panelEl.hidden = true;
    panelEl.setAttribute("aria-hidden", "true");
    panelBody.replaceChildren();
    render();
  }

  function isHighlighted(n) {
    return state.highlightIds != null && state.highlightIds.has(n.id);
  }

  function platformFocusActive() {
    return state.selected?.type === "mega_node" && state.highlightIds != null && state.highlightIds.size > 0;
  }

  function profileFocusActive() {
    return (
      (state.selected?.type === "regular_node" || state.selected?.type === "post") &&
      state.focusPosts != null
    );
  }

  function focusedProfileId() {
    if (state.selected?.type === "regular_node") return state.selected.id;
    if (state.selected?.type === "post") return state.selected.profileId;
    return null;
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
    const focusing = platformFocusActive();
    const profileFocus = profileFocusActive();
    const focusProfileId = focusedProfileId();
    syncPostWorldPositions();
    if (profileFocus && focusProfileId != null) {
      const profile = state.byId.get(focusProfileId);
      if (profile) state.focusPosts = profile.posts || [];
    }

    ctx.save();
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    // Faint distance orbit guides around platforms when focused
    if (focusing && state.selected?.type === "mega_node") {
      const platform = state.selected;
      const distances = new Set(
        getProfilesForPlatform(platform).map((p) => Math.max(1, Number(p.distance) || 1))
      );
      ctx.lineWidth = 1 / t.k;
      ctx.setLineDash([4 / t.k, 4 / t.k]);
      for (const d of [...distances].sort((a, b) => a - b)) {
        ctx.beginPath();
        ctx.arc(platform.x, platform.y, orbitRadius(platform, d), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(platform.color || COLORS.orphan, 0.35);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    ctx.lineWidth = 1 / t.k;
    for (const l of state.links) {
      const s = l.source;
      const tg = l.target;
      if (!s || !tg || !Number.isFinite(s.x) || !Number.isFinite(tg.x)) continue;
      const related = focusing && isHighlighted(s) && isHighlighted(tg);
      const profileSpoke =
        profileFocus && (s.id === focusProfileId || tg.id === focusProfileId);
      let color = COLORS.edge;
      if ((focusing || profileFocus) && !related && !profileSpoke) {
        color = hexToRgba(COLORS.edge, COLORS.dimAlpha * 0.65);
      } else if (related || profileSpoke) {
        color = hexToRgba(COLORS.mutedText, 0.5);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = (related || profileSpoke ? 2.75 : 1) / t.k;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tg.x, tg.y);
      ctx.stroke();
    }

    // Profile → post spokes — structural edge at rest; Civic Signal when stance shown
    forEachPost((post, profile) => {
      if (!Number.isFinite(post.x) || !Number.isFinite(profile.x)) return;
      const inFocus = isPostInFocus(post);
      const selectedPost = state.selected?.type === "post" && state.selected.id === post.id;
      const showStance = selectedPost || (profileFocus && inFocus);
      let alpha;
      let width;
      if (!inFocus && (focusing || profileFocus)) {
        alpha = COLORS.dimAlpha * 0.35;
        width = 0.6;
      } else if (selectedPost) {
        alpha = 0.95;
        width = 3.75;
      } else if (showStance) {
        alpha = 0.85;
        width = 2.75;
      } else {
        alpha = focusing && inFocus ? 0.55 : 0.4;
        width = focusing && inFocus ? 1.35 : 0.9;
      }
      const sk = stanceKey(post);
      const hasStance = sk && sk !== UNKNOWN_STANCE && STANCE_COLORS[sk];
      const spokeColor = showStance
        ? hasStance
          ? stanceColor(sk)
          : COLORS.postNoData
        : COLORS.edge;
      ctx.strokeStyle = hexToRgba(spokeColor, alpha);
      ctx.lineWidth = width / t.k;
      ctx.beginPath();
      ctx.moveTo(profile.x, profile.y);
      ctx.lineTo(post.x, post.y);
      ctx.stroke();
    });

    // Profiles
    for (const n of state.nodes) {
      if (n.type !== "regular_node") continue;
      if (!Number.isFinite(n.x)) continue;
      const selected = isHighlighted(n) || n.id === focusProfileId;
      const dimmed = (focusing && !isHighlighted(n)) || (profileFocus && n.id !== focusProfileId);
      const baseR = n.radius || settings.profileSize;
      const r = selected ? baseR + 1.25 : baseR;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      if (dimmed) {
        ctx.fillStyle = hexToRgba(n.color || COLORS.profileFallback, COLORS.dimAlpha);
      } else if (state.selected?.type === "regular_node" && state.selected === n) {
        ctx.fillStyle = COLORS.profileSelected;
      } else {
        ctx.fillStyle = n.color || COLORS.profileFallback;
      }
      ctx.fill();
      if (n.id === focusProfileId) {
        ctx.strokeStyle = COLORS.selectionRing;
        ctx.lineWidth = 3.25 / t.k;
        ctx.stroke();
      } else if (focusing && selected) {
        ctx.strokeStyle = darkenHex(n.color || COLORS.profileFallback, 0.35);
        ctx.lineWidth = 2.5 / t.k;
        ctx.stroke();
      }
    }

    // Posts — muted at rest; Civic Signal when profile/post selection highlights stance
    forEachPost((post) => {
      if (!Number.isFinite(post.x)) return;
      const inFocus = isPostInFocus(post);
      const sk = stanceKey(post);
      const sc = stanceColor(sk);
      const hasStance = sk && sk !== UNKNOWN_STANCE && STANCE_COLORS[sk];
      const selectedPost = state.selected?.type === "post" && state.selected.id === post.id;
      const showStance = selectedPost || (profileFocus && inFocus);
      const r = selectedPost ? POST_R + 2 : showStance ? POST_R + 1.25 : POST_R;
      ctx.beginPath();
      ctx.arc(post.x, post.y, r, 0, Math.PI * 2);
      if (!inFocus && (focusing || profileFocus)) {
        ctx.fillStyle = hexToRgba(COLORS.postFallback, COLORS.dimAlpha);
        ctx.fill();
      } else if (showStance) {
        ctx.fillStyle = hasStance ? sc : COLORS.postNoData;
        ctx.fill();
        ctx.strokeStyle = hasStance ? sc : COLORS.selectionRing;
        ctx.lineWidth = (selectedPost ? 3.5 : 2.75) / t.k;
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.postFallback;
        ctx.fill();
      }
    });

    const showProfileLabels = t.k >= (state.baselineZoom || 1) * LABEL_ZOOM_MULT;
    const profileFontSize = 10 / t.k;

    if (showProfileLabels) {
      ctx.fillStyle = COLORS.text;
      ctx.font = `500 ${profileFontSize}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (const n of state.nodes) {
        if (n.type !== "regular_node" || !Number.isFinite(n.x)) continue;
        if (focusing && !isHighlighted(n)) continue;
        if (profileFocus && n.id !== focusProfileId) continue;
        ctx.fillText(
          truncateLabel(n.displayLabel, PROFILE_LABEL_MAX_CHARS),
          n.x,
          n.y + (n.radius || settings.profileSize) + 2 / t.k
        );
      }
    }

    // Platforms (mega nodes) on top
    for (const n of state.nodes) {
      if (n.type !== "mega_node") continue;
      if (!Number.isFinite(n.x)) continue;
      const hovered = state.hovered === n;
      const selected = isHighlighted(n);
      const dimmed = (focusing && !selected) || profileFocus;
      const fill = dimmed
        ? hexToRgba(n.color || COLORS.orphan, COLORS.dimAlpha)
        : n.color || COLORS.orphan;
      const stroke = selected
        ? COLORS.selectionRing
        : hovered
          ? COLORS.hoverStroke
          : n.strokeColor || COLORS.orphanStroke;
      const strokeW = (selected ? 3.5 : hovered ? 2.5 : 1.5) / t.k;
      drawNodeCircle(n, fill, stroke, strokeW);

      if (n.userPinned) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 3 / t.k, 0, Math.PI * 2);
        ctx.strokeStyle = focusing ? hexToRgba(COLORS.text, COLORS.dimAlpha + 0.2) : COLORS.text;
        ctx.lineWidth = 1.5 / t.k;
        ctx.setLineDash([4 / t.k, 3 / t.k]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = dimmed ? hexToRgba(COLORS.text, COLORS.dimAlpha + 0.15) : COLORS.text;
      ctx.font = `700 ${MEGA_LABEL_SIZE}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(truncateLabel(n.displayLabel, MEGA_LABEL_MAX_CHARS), n.x, n.y);
    }

    if (state.hovered && state.hovered.type === "regular_node") {
      const n = state.hovered;
      ctx.beginPath();
      ctx.arc(n.x, n.y, (n.radius || settings.profileSize) + 1.5 / t.k, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.hoverStroke;
      ctx.lineWidth = 1.5 / t.k;
      ctx.stroke();
    } else if (state.hovered && state.hovered.type === "post") {
      const n = state.hovered;
      ctx.beginPath();
      ctx.arc(n.x, n.y, POST_R + 1.5 / t.k, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.hoverStroke;
      ctx.lineWidth = 1.5 / t.k;
      ctx.stroke();
    }

    ctx.restore();

    if (state.hovered && state.hovered.type === "post" && state.hovered !== state.selected) {
      drawHoverTooltip(state.hovered);
    } else if (state.hovered && state.hovered.type === "regular_node" && state.hovered !== state.selected) {
      drawHoverTooltip(state.hovered);
    } else if (state.hovered && state.hovered.type === "mega_node") {
      if (!(state.hovered === state.selected && state.selected?.type === "mega_node")) {
        drawHoverTooltip(state.hovered);
      }
    }
  }

  function drawHoverTooltip(n) {
    const screenX = n.x * state.transform.k + state.transform.x;
    const screenY = n.y * state.transform.k + state.transform.y;
    let text = n.displayLabel || n.rawId;
    if (n.type === "regular_node") {
      const bits = [text];
      if (n.category) bits.push(categoryLabel(n.category));
      if (n.distance != null) bits.push(`d=${n.distance}`);
      const pc = (n.posts || []).length;
      if (pc) bits.push(`${pc} posts`);
      text = bits.join(" · ");
    } else if (n.type === "post") {
      const bits = [n.rawId || "Post"];
      const sk = stanceKey(n);
      if (sk !== UNKNOWN_STANCE) bits.push(STANCE_LABELS[sk] || sk);
      text = bits.join(" · ");
    }
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

  function findPostAt(gx, gy) {
    let hit = null;
    let bestDist = Infinity;
    forEachPost((post) => {
      if (!Number.isFinite(post.x)) return;
      // Prefer in-focus posts when something is selected
      if ((platformFocusActive() || profileFocusActive()) && !isPostInFocus(post)) return;
      const dist = Math.hypot(post.x - gx, post.y - gy);
      const hitR = Math.max(POST_R, 6 / state.transform.k);
      if (dist <= hitR && dist < bestDist) {
        bestDist = dist;
        hit = post;
      }
    });
    // Fall back to any post if nothing in focus matched (e.g. click dimmed)
    if (!hit) {
      forEachPost((post) => {
        if (!Number.isFinite(post.x)) return;
        const dist = Math.hypot(post.x - gx, post.y - gy);
        const hitR = Math.max(POST_R, 6 / state.transform.k);
        if (dist <= hitR && dist < bestDist) {
          bestDist = dist;
          hit = post;
        }
      });
    }
    return hit;
  }

  function findNodeAt(gx, gy) {
    const postHit = findPostAt(gx, gy);
    if (postHit) return postHit;

    let hit = null;
    let bestDist = Infinity;
    for (const n of state.nodes) {
      if (!Number.isFinite(n.x)) continue;
      const r = nodeRadius(n);
      const dist = Math.hypot(n.x - gx, n.y - gy);
      const hitR = n.type === "regular_node" ? Math.max(r, 6 / state.transform.k) : r;
      if (dist <= hitR && dist < bestDist) {
        bestDist = dist;
        hit = n;
      }
    }
    return hit;
  }

  function findPlatformAt(gx, gy) {
    let hit = null;
    let bestDist = Infinity;
    for (const n of state.nodes) {
      if (n.type !== "mega_node" || !Number.isFinite(n.x)) continue;
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
          if (findPlatformAt(gx, gy)) return false;
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
        if (hit?.type === "mega_node") canvas.style.cursor = "grab";
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
      const platform = findPlatformAt(gx, gy);
      pointerDown = { x: event.clientX, y: event.clientY, dragged: false };

      if (platform) {
        event.preventDefault();
        event.stopPropagation();
        state.dragging = {
          node: platform,
          lastX: gx,
          lastY: gy,
        };
        pinClusterForDrag(platform);
        canvas.setPointerCapture?.(event.pointerId);
        canvas.style.cursor = "grabbing";
        if (state.simulation) state.simulation.alphaTarget(0).stop();
        render();
      }
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      const [gx, gy] = pointerToGraph(event);
      const dx = gx - state.dragging.lastX;
      const dy = gy - state.dragging.lastY;
      if (dx === 0 && dy === 0) return;
      pointerDown && (pointerDown.dragged = true);
      translateCluster(state.dragging.node, dx, dy);
      state.dragging.lastX = gx;
      state.dragging.lastY = gy;
      render();
    });

    canvas.addEventListener("pointerup", (event) => {
      if (event.button !== 0) return;

      if (state.dragging) {
        finalizeClusterDrag(state.dragging.node);
        state.dragging = null;
        canvas.style.cursor = "grab";
        if (state.simulation) {
          state.simulation.alpha(0.12).restart();
        }
        render();
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

      if (hit && hit.type === "post") {
        openPostPanel(hit);
      } else if (hit && hit.type === "regular_node") {
        openProfilePanel(hit);
      } else if (hit && hit.type === "mega_node") {
        openPlatformPanel(hit);
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
        if (!panelEl.hidden) closePanel();
        else if (settingsEl && !settingsEl.hidden) setSettingsOpen(false);
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
    setupSettings();
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
      state.rawGraph = data;
      loadGraph(data);

      if (sentimentRes.ok) {
        const csvText = await sentimentRes.text();
        attachPostsToProfiles(parseCsv(csvText));
      } else {
        console.warn(`Sentiment CSV not loaded (${sentimentRes.status}); continuing without posts.`);
      }

      seedPositions();
      layoutAllPosts({ immediate: true });
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
