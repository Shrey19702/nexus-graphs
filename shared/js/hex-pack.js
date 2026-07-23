/**
 * Hex-lattice slot generation for stance-ordered post packing.
 * Apps assign posts into slots with their own stance order / lerp policy.
 */
export function buildHexSlots({ count, bodyR, postR, orbitGap }) {
  if (count <= 0) return [];
  const spacing = postR * 2 + 2.5;
  const innerRadius = bodyR + orbitGap + postR;
  const rowPitch = (spacing * Math.sqrt(3)) / 2;
  let outerRadius = innerRadius + spacing;
  let slots = [];

  while (slots.length < count) {
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
    if (slots.length < count) outerRadius += spacing;
  }

  slots.sort((a, b) => a.dist - b.dist);
  slots = slots.slice(0, count);
  slots.sort((a, b) => {
    const aa = (Math.atan2(a.y, a.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const ba = (Math.atan2(b.y, b.x) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    return aa - ba || a.dist - b.dist;
  });
  return slots;
}
