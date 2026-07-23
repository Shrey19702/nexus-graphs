/** Shared d3.zoom wiring. Expects global `d3`. */

export function setupZoom({ canvas, state, onZoom, filter }) {
  const zoomBehavior = d3
    .zoom()
    .scaleExtent([0.05, 12])
    .filter(filter || ((event) => {
      if (event.type === "wheel") return true;
      return event.button === 0;
    }))
    .on("zoom", (event) => {
      state.transform = event.transform;
      onZoom();
    });
  d3.select(canvas).call(zoomBehavior);
  return zoomBehavior;
}
