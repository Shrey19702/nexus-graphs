/** Shared D3 force helpers. Expects global `d3` from CDN. */

export function typeRepel(strengthMag, distanceMax, predicate) {
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

export function typeCollide(radius, strength, iterations, predicate) {
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

/** Push same-type nodes apart when their parentKey differs. */
export function forceForeignClusterRepel(opts) {
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
