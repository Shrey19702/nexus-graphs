import { init } from "./app.js?v=2026-08-26-hub-images";

init().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) status.textContent = "Failed to load report";
  const report = document.getElementById("report");
  if (report) {
    const detail = err?.message ? ` ${escapeAttr(err.message)}` : "";
    report.innerHTML = `<p class="error">Could not build the report.${detail} Check the console, hard-refresh, and ensure the local server is running from the repo root.</p>`;
  }
});

function escapeAttr(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
