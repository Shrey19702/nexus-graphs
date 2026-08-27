/**
 * Hub: dataset tabs → Themes / Report (and Profiles when available).
 */
import {
  listCorpora,
  resolveCorpusId,
  rememberCorpus,
  getCorpus,
} from "./shared/js/corpora.js?v=2026-08-26-hub-images";

const tabsEl = document.getElementById("hub-tabs");
const metaEl = document.getElementById("hub-corpus-meta");
const navEl = document.getElementById("hub-nav");

function missingNotes(corpus) {
  const missing = [];
  if (!corpus.hasPostedAt) missing.push("posted_at");
  if (!corpus.hasPlatform) missing.push("platform");
  return missing;
}

function renderTabs(activeId) {
  const frag = document.createDocumentFragment();
  for (const corpus of listCorpora()) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hub-tab";
    btn.setAttribute("role", "tab");
    btn.dataset.corpus = corpus.id;
    btn.id = `tab-${corpus.id}`;
    btn.setAttribute("aria-selected", corpus.id === activeId ? "true" : "false");
    btn.setAttribute("aria-controls", "hub-nav");
    btn.textContent = corpus.label;
    btn.title = corpus.title;
    btn.addEventListener("click", () => selectCorpus(corpus.id));
    frag.appendChild(btn);
  }
  tabsEl.replaceChildren(frag);
}

function renderMeta(corpus) {
  const missing = missingNotes(corpus);
  const bits = [corpus.title];
  if (missing.length) {
    bits.push(`CSV missing ${missing.join(" + ")} (date filter / timeline limited)`);
  } else {
    bits.push("posted_at + platform present");
  }
  if (!corpus.profiles) {
    bits.push("Profiles view is CJP-only");
  }
  metaEl.hidden = false;
  metaEl.textContent = bits.join(" · ");
}

function withCorpusParam(href, corpusId) {
  const url = new URL(href, window.location.href);
  url.searchParams.set("corpus", corpusId);
  // Keep path relative for the hub links
  return `${url.pathname}${url.search}`;
}

function renderLinks(corpus) {
  for (const link of navEl.querySelectorAll("a.hub-link")) {
    const view = link.dataset.view;
    if (view === "profiles") {
      const enabled = Boolean(corpus.profiles);
      link.classList.toggle("is-disabled", !enabled);
      link.setAttribute("aria-disabled", enabled ? "false" : "true");
      if (enabled) {
        link.href = withCorpusParam("platform-profiles/", corpus.id);
        link.removeAttribute("tabindex");
      } else {
        link.href = "#";
        link.tabIndex = -1;
      }
      continue;
    }
    const base = view === "themes" ? "narratives-graph/" : "reports-nexus/";
    link.href = withCorpusParam(base, corpus.id);
    link.classList.remove("is-disabled");
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
  }
}

function selectCorpus(id) {
  const corpus = getCorpus(id);
  if (!corpus) return;
  rememberCorpus(corpus.id);
  renderTabs(corpus.id);
  renderMeta(corpus);
  renderLinks(corpus);
  // Reflect in the address bar without reload
  const url = new URL(window.location.href);
  url.searchParams.set("corpus", corpus.id);
  history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function init() {
  const activeId = resolveCorpusId();
  selectCorpus(activeId);
}

init();
