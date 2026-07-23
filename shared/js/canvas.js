/** Canvas sizing, hit geometry helpers, and simple draw primitives. */

export function getDims() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/** Resize canvas to viewport; mutates state.width/height/dpr. */
export function resizeCanvas(canvas, ctx, state) {
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

export function truncateLabel(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

export function updateZoomDisplay(zoomLabel, state) {
  const rel = state.transform.k / (state.baselineZoom || 1);
  zoomLabel.textContent = `${Math.round(rel * 100)}%`;
}

export function pointerToGraph(event, canvas, state) {
  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  const t = state.transform;
  return [(sx - t.x) / t.k, (sy - t.y) / t.k];
}

export function drawNodeCircle(ctx, n, fill, stroke, strokeWidth) {
  ctx.beginPath();
  ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

export function panelBleedWidth(panelEl, panelMaxW) {
  if (!panelEl || panelEl.hidden) return 0;
  return Math.min(panelMaxW, window.innerWidth * 0.92);
}

export function settingsBleedWidth(settingsEl) {
  if (!settingsEl || settingsEl.hidden) return 0;
  return Math.min(300, window.innerWidth * 0.92);
}
