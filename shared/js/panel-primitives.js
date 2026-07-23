/** Shared detail-panel DOM builders. */

export function appendField(parent, label, valueEl) {
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

export function makeValue(text, mono = false) {
  const el = document.createElement("div");
  el.className = mono ? "panel-value mono" : "panel-value";
  el.textContent = text;
  return el;
}

export function makeLink(href, label) {
  const a = document.createElement("a");
  a.className = "panel-link";
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label || href;
  return a;
}

export function makeStanceBadge(stance, { stanceColor, stanceLabels, stanceColors, unknownStance }) {
  const el = document.createElement("span");
  el.className = "stance-badge";
  const key = stance && stanceColors[stance] ? stance : unknownStance;
  el.style.setProperty("--stance-color", stanceColor(key));
  el.textContent = key === unknownStance ? "No sentiment" : (stanceLabels[key] || key);
  return el;
}
